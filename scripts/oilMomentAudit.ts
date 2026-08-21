/**
 * scripts/oilMomentAudit.ts — [session 69 §2b] **What did the bot actually see
 * at the moment it spent an oil?**
 *
 * The user watched a cast play cards on turns 0-2 and then finish the fish
 * with a Mid Relaxing Oil on turn 3, and read that as the bot reaching for a
 * consumable with resources still in hand. Answering that requires the board
 * as it stood at the consume, not a summary of the cast — specifically whether
 * a card in hand could have killed the fish, and with what probability.
 *
 * So this replays a REAL cast out of `logs/*.jsonl` up to each
 * `use_fishing_item` POST and rebuilds the same distribution the live loop had
 * at that instant: the mined-pattern matcher (seeded and advanced on the
 * cast's own observed moves), the sticky step-class ring model, the contextual
 * fallback, and the posterior mixture weight — the pipeline of
 * `scripts/liveFishing.ts`, imported rather than re-implemented, so this
 * cannot drift into describing a different bot.
 *
 * ## Two limits, both load-bearing
 *
 * **The corpus has grown since.** `data/fish-patterns.jsonl` now contains the
 * cast being audited, so the rebuilt distribution is the one TODAY's tables
 * give, not byte-for-byte the one the live loop used. `--exclude-self` drops
 * the audited cast's own rows, which is the honest default for asking "could
 * it have known"; the numbers below are reported both ways when they differ.
 *
 * **This is not a counterfactual outcome.** It says what the gate's inputs
 * were. It cannot say whether holding the oil would have landed the fish —
 * the oil was spent, and that branch is gone (`oilShadow.ts`'s standing
 * caveat).
 *
 * Usage:
 *   npx tsx scripts/oilMomentAudit.ts                      # every consume in logs/
 *   npx tsx scripts/oilMomentAudit.ts --cast=13022748
 *   npx tsx scripts/oilMomentAudit.ts --cast=13022748 --include-self
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { buildHand, fishCell, loadMinedPatterns, loadTransitionLog } from "./liveFishing.js";
import { profileArg, resolveProfile } from "../src/profile.js";
import { initMatcher, mixDistributions, observe, predictDistribution, type MatcherState } from "../src/strategy/fishing/matcher.js";
import {
  buildContextualMap,
  contextualFallback,
  previousDisplacement,
  DEFAULT_SHRINKAGE_K,
} from "../src/strategy/fishing/contextualFallback.js";
import {
  buildStepClassTable,
  estimateSwitchProbability,
  intersectWithRing,
  lastStepClass,
  stickyStepDistribution,
  DEFAULT_RING_MODEL_OPTIONS,
} from "../src/strategy/fishing/stepClass.js";
import {
  initMatcherPosterior,
  matcherPriorFromSupport,
  matcherWeight,
  probabilityOf,
  updateMatcherPosterior,
  DEFAULT_MATCHER_POSTERIOR_OPTIONS,
  type MatcherPosteriorOptions,
} from "../src/strategy/fishing/matcherPosterior.js";
import { groupByCast, isCleanCast, loadTransitionRecords } from "../src/sim/fishing/transitionCorpus.js";
import { supportingCastCount } from "../src/sim/fishing/patternMining.js";
import { toCandidate } from "../src/sim/fishing/patterns.js";
import { allCells, cellKey, reachableCells, zonesToCells, type Cell } from "../src/sim/fishing/geometry.js";
import { evaluateCardAtFocus, type Distribution, type FishingCardLike } from "../src/strategy/fishing/cardChoice.js";
import {
  bestConnectProbabilityFromFrozenCell,
  bestKillProbability,
  conserving,
  meetsThreshold,
  onDemandTriggers,
  PAYLOAD_OIL_EFFECTS,
  RECOMMENDED_NECESSITY_THRESHOLDS,
  type OilDecisionState,
} from "../src/strategy/fishing/oilTiming.js";
import { MID_FOCUS_OIL_ITEM_ID, MID_RELAXING_OIL_ITEM_ID } from "../src/strategy/fishing/oilPolicy.js";

const MAX_TURNS = 60;

// Resolved through the profile seam rather than hard-coded, so this reads the
// SAME corpus and logs the live loop wrote under whichever profile is active —
// an audit pointed at a different account's ledger is worse than no audit.
const profile = resolveProfile(profileArg(process.argv));
const TRANSITIONS_PATH = join(profile.dataRoot, "fish-patterns.jsonl");
const LOG_ROOT = profile.logRoot;

interface LogRow { event?: string; body?: { action?: string; data?: Record<string, unknown> }; resp?: { data?: { doc?: RawDoc } } }
interface RawDoc { docId: string; COMPLETE_CID?: boolean; SUCCESS_CID?: boolean; data: Record<string, unknown> }

/** One `use_fishing_item` POST, with the doc that stood immediately before it. */
interface ConsumeMoment { logFile: string; castId: string; turn: number; itemId: number; doc: RawDoc; history: Cell[] }

function readLog(path: string): LogRow[] {
  const out: LogRow[] = [];
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try { out.push(JSON.parse(line) as LogRow); } catch { /* a truncated tail is not a finding */ }
  }
  return out;
}

/**
 * Walk one log and pull out every consume moment.
 *
 * `turn` is counted the way the live loop counts it — incremented only on a
 * `play_cards` response — so a turn number here means the same thing it means
 * in the loop and in a shadow record. `history` is the fish's observed cells,
 * which is the matcher's entire state.
 */
function consumeMoments(path: string): ConsumeMoment[] {
  const rows = readLog(path);
  const out: ConsumeMoment[] = [];
  let doc: RawDoc | null = null;
  let history: Cell[] = [];
  let turn = 0;
  let pending: { action: string; itemId: number } | null = null;

  for (const r of rows) {
    if (r.event === "post" && r.body?.action) {
      const action = r.body.action;
      if (action === "use_fishing_item" && doc) {
        out.push({
          logFile: path,
          castId: doc.docId,
          turn,
          itemId: Number(r.body.data?.itemId ?? 0),
          doc,
          history: [...history],
        });
      }
      pending = { action, itemId: Number(r.body.data?.itemId ?? 0) };
      continue;
    }
    if (r.event === "post_response" && r.resp?.data?.doc) {
      const next = r.resp.data.doc;
      if (pending?.action === "start_run") {
        doc = next; history = [fishCell(next as never)]; turn = 0;
      } else if (pending?.action === "play_cards") {
        doc = next; history.push(fishCell(next as never)); turn += 1;
      } else if (pending?.action === "use_fishing_item") {
        doc = next; // the fish does not move on a consume
      }
      pending = null;
    }
  }
  return out;
}

/** The live pipeline's distribution at a moment, rebuilt from the fish's observed history. */
function rebuildDistribution(m: ConsumeMoment, excludeSelf: boolean): Distribution {
  const gridSize = Number(m.doc.data.gridSize);
  const minedPatterns = loadMinedPatterns();
  const startCell = m.history[0]!;
  let matcher: MatcherState = initMatcher(
    minedPatterns.map((p) => toCandidate(p, startCell, gridSize, MAX_TURNS)),
    startCell,
  );
  const transitionLog = loadTransitionLog(TRANSITIONS_PATH);
  const all = groupByCast(loadTransitionRecords(TRANSITIONS_PATH)).filter(isCleanCast);
  // Dropping the audited cast's OWN rows is the honest default: "could the bot
  // have known" must not be answered with evidence the cast itself produced.
  const contextCasts = excludeSelf ? all.filter((c) => String(c.castId) !== String(m.castId)) : all;
  const contextMap = buildContextualMap(contextCasts);
  const stepClassTable = buildStepClassTable(contextCasts);
  const switchEstimate = estimateSwitchProbability(contextCasts);
  const support = supportingCastCount(contextCasts, minedPatterns);
  const opts: MatcherPosteriorOptions = {
    prior: matcherPriorFromSupport(support.supportingCasts, support.totalCasts),
    ...DEFAULT_MATCHER_POSTERIOR_OPTIONS,
  };
  let posterior = initMatcherPosterior(opts.prior);

  // Replay the cast's observed moves through the matcher and the posterior,
  // exactly as the live loop did, so the state at the consume is the state the
  // loop held — not a fresh matcher pointed at the last cell.
  const distAt = (upto: number): Distribution => {
    const hist = m.history.slice(0, upto + 1);
    const cur = hist[hist.length - 1]!;
    const prevDelta = previousDisplacement(hist);
    const stepClass = lastStepClass(hist);
    const ringDist = stickyStepDistribution(cur, stepClass, prevDelta, stepClassTable, gridSize, DEFAULT_RING_MODEL_OPTIONS, switchEstimate.s);
    const matcherDist = matcher.candidates.length > 0 ? predictDistribution(matcher) : null;
    const matcherOnRing = matcherDist
      ? stepClass !== null
        ? (intersectWithRing(matcherDist, cur, stepClass, gridSize) ?? ringDist)
        : matcherDist
      : null;
    const weight = matcherOnRing ? matcherWeight(posterior, opts) : 0;
    return matcherOnRing
      ? mixDistributions(matcherOnRing, ringDist, weight)
      : (ringDist ??
        contextualFallback(cur, prevDelta, contextMap, transitionLog, gridSize, { shrinkageK: DEFAULT_SHRINKAGE_K }));
  };

  for (let i = 0; i + 1 < m.history.length; i++) {
    const hist = m.history.slice(0, i + 1);
    const cur = hist[hist.length - 1]!;
    const to = m.history[i + 1]!;
    const stepClass = lastStepClass(hist);
    const ringDist = stickyStepDistribution(cur, stepClass, previousDisplacement(hist), stepClassTable, gridSize, DEFAULT_RING_MODEL_OPTIONS, switchEstimate.s);
    const matcherDist = matcher.candidates.length > 0 ? predictDistribution(matcher) : null;
    const matcherOnRing = matcherDist
      ? stepClass !== null
        ? (intersectWithRing(matcherDist, cur, stepClass, gridSize) ?? ringDist)
        : matcherDist
      : null;
    if (matcherOnRing && ringDist) {
      posterior = updateMatcherPosterior(posterior, probabilityOf(matcherOnRing, to), probabilityOf(ringDist, to), opts);
    }
    matcher = observe(matcher, to);
  }
  return distAt(m.history.length - 1);
}

function decisionState(m: ConsumeMoment, dist: Distribution): OilDecisionState {
  const d = m.doc.data;
  const focus = d.focusPoint as number[];
  return {
    turn: m.turn,
    fishHp: Number(d.fishHp),
    fishMaxHp: Number(d.fishMaxHp),
    mana: Number(d.playerHp),
    focusRemaining: Number(d.focusMeter),
    focusMax: Number(d.focusMeterMax),
    focusOilHeld: 99,
    relaxingOilHeld: 99,
    focusCell: { x: focus[0] ?? 1, y: focus[1] ?? 1 },
    board: { hand: buildHand(m.doc as never), dist, gridSize: Number(d.gridSize) },
  };
}

function oilName(id: number): string {
  return id === MID_RELAXING_OIL_ITEM_ID ? "Mid Relaxing (937)" : id === MID_FOCUS_OIL_ITEM_ID ? "Mid Focus (942)" : `item ${id}`;
}

function report(m: ConsumeMoment, excludeSelf: boolean): void {
  const dist = rebuildDistribution(m, excludeSelf);
  const s = decisionState(m, dist);
  const d = m.doc.data;
  const gridSize = Number(d.gridSize);
  const wanted = onDemandTriggers(s, PAYLOAD_OIL_EFFECTS);
  const shadow = conserving.decide(s, PAYLOAD_OIL_EFFECTS);

  // [session 68 §2] A consume POSTed against an already-COMPLETE doc is the
  // defect that cost a cast — the server rejects it. The moment is still worth
  // printing (it is the state the rejected POST was sent on), but it must never
  // be counted as a decision the gate took.
  const postTerminal = m.doc.COMPLETE_CID === true;
  console.log(
    `\n════ cast ${m.castId}, turn ${m.turn} — spent ${oilName(m.itemId)}` +
      (postTerminal ? "   ★ SENT AGAINST AN ALREADY-COMPLETE DOC — server rejected it; not a gate decision" : ""),
  );
  console.log(`  ${m.logFile}`);
  console.log(`  fish ${d.fishHp}/${d.fishMaxHp} at [${(d.fishPosition as number[]).join(",")}] (was [${(d.previousFishPosition as number[]).join(",")}])`);
  console.log(`  player ${d.playerHp}/${d.playerMaxHp}   focus meter ${d.focusMeter}/${d.focusMeterMax} at [${(d.focusPoint as number[]).join(",")}]   grid ${gridSize}`);
  console.log(`  draw pile ${d.cardInDrawPile}, discard ${(d.discard as number[]).length}, hand ${(d.hand as number[]).length}`);
  console.log(`  on-demand wanted [${wanted.join(",")}]; conserve(r=1,f=1) would take [${shadow.join(",") || "none"}]`);

  // The per-card table. `focusRemaining` is what decides whether the marker
  // could be moved at all, so it is printed beside the placements considered.
  const cells = reachableCells(gridSize, s.focusCell, Math.max(0, s.focusRemaining));
  console.log(`  placements available: ${cells.length} (${cells.map((c) => `[${c.x},${c.y}]`).join(" ")})`);
  console.log(`  ── every card in hand, at its best placement ──`);
  for (const card of s.board.hand as FishingCardLike[]) {
    const hit = (card.hitEffects[0]?.amount ?? 0);
    let best = { p: -1, cell: cells[0]!, covered: [] as Cell[] };
    for (const f of cells) {
      const { pHit, pCrit } = evaluateCardAtFocus(card, f, dist, gridSize, 1);
      const p = pHit + pCrit;
      if (p > best.p) best = { p, cell: f, covered: zonesToCells(f, card.hitZones, gridSize) };
    }
    const lethal = hit >= s.fishHp;
    console.log(
      `    card ${String(card.id).padStart(3)}  cost ${card.manaCost}  hit ${String(hit).padStart(2)} dmg ` +
        `${lethal ? "(LETHAL)" : "(not lethal)"}  zones [${card.hitZones.join(",")}]  ` +
        `best p(connect) ${best.p.toFixed(4)} at [${best.cell.x},${best.cell.y}] covering ` +
        `${best.covered.length}/${allCells(gridSize).length} cells {${best.covered.map((c) => `${c.x},${c.y}`).join(" ")}}`,
    );
  }

  const kill = bestKillProbability(s);
  const connect = bestConnectProbabilityFromFrozenCell(s);
  console.log(`  ── the gate's own inputs ──`);
  console.log(`    bestKillProbability            ${kill.toFixed(6)}   certain? ${meetsThreshold(kill, RECOMMENDED_NECESSITY_THRESHOLDS.relaxing) ? "YES" : "no"}`);
  console.log(`    bestConnectProbability(frozen) ${connect.toFixed(6)}   certain? ${meetsThreshold(connect, RECOMMENDED_NECESSITY_THRESHOLDS.focus) ? "YES" : "no"}`);
  const top = [...dist.values()].sort((a, b) => b.p - a.p).slice(0, 5);
  console.log(`    fish-move distribution, top 5: ${top.map((t) => `[${t.cell.x},${t.cell.y}] ${t.p.toFixed(3)}`).join("  ")}`);
  // A distribution that does not sum to 1 would silently deflate every
  // probability above it, so it is checked rather than assumed.
  const mass = [...dist.values()].reduce((a, b) => a + b.p, 0);
  if (Math.abs(mass - 1) > 1e-6) console.log(`    ★★★ distribution mass ${mass} — NOT 1, every probability above is suspect`);
  void cellKey;
}

function main(): void {
  const argv = process.argv.slice(2);
  const castFilter = argv.find((a) => a.startsWith("--cast="))?.split("=")[1];
  const excludeSelf = !argv.includes("--include-self");
  console.log("▸ oilMomentAudit — the board as it stood at each live oil consume");
  console.log(`  profile ${profile.name}, corpus ${TRANSITIONS_PATH}, audited cast's own rows ${excludeSelf ? "EXCLUDED" : "INCLUDED"} (--include-self flips this)`);
  console.log("  MODELLED INPUTS, OBSERVED BOARD. This says what the gate saw, never what holding the oil would have cost.");

  const logs = readdirSync(LOG_ROOT).filter((f) => f.startsWith("fishing-") && f.endsWith(".jsonl")).sort();
  let found = 0;
  for (const f of logs) {
    for (const m of consumeMoments(join(LOG_ROOT, f))) {
      if (castFilter && m.castId !== castFilter) continue;
      report(m, excludeSelf);
      found++;
    }
  }
  if (found === 0) console.log(`\n  no consume found${castFilter ? ` for cast ${castFilter}` : ""} in ${logs.length} log file(s).`);
  else console.log(`\n  ${found} consume moment(s) audited.`);
}

main();
