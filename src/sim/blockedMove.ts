/**
 * `blockedMove` — WHAT AN INTUITION PROC ACTUALLY EXCLUDES, MEASURED.
 *
 * [session 129] This module exists to answer ONE question and to stop it being
 * re-asked: DECISIONS 2026-09-08 recorded `blockedMove` as unwired and listed
 * the blocker as *"unsettled whether the exclusion applies to the current
 * exchange or only the next"*. It sat untouched for three sessions because
 * nobody could wire it without that answer, and CLAUDE.md rule 4 forbids
 * taking a live strategy change to the server on a guess.
 *
 * ⭐ **THE ANSWER, AND IT KILLS THE PROPOSED SHAPE.**
 *
 *   - **It does NOT bind the CURRENT exchange.** The enemy played the blocked
 *     move in the very exchange the proc fired in **6 of 20** times, against
 *     **6.67 expected** — one-sided p = 0.48. That is chance, exactly.
 *   - **The NEXT exchange is DEPRESSED but NOT EXCLUDED — 2 of 20**, against
 *     the same 6.67 expected, one-sided p = 0.018.
 *
 * ⛔ **So "remove `blockedMove` from the enemy's distribution" — the wiring
 * every brief since session 125 has proposed — is FALSIFIED.** A hard
 * exclusion assigns probability ZERO to an event this corpus contains TWICE.
 * Shipping it would make the opponent model confidently wrong about 10% of
 * post-proc exchanges, which is worse than the present behaviour of ignoring
 * the field: a three-way distribution over a slightly-wrong prior degrades
 * gracefully, a zero does not.
 *
 * **What a correct wiring would be, and why it is NOT done here.** The field
 * is a SOFT prior on the next exchange — roughly a 3.3x depression, 10% against
 * a 33% base. Turning that into a reweighting needs a MAGNITUDE, and n = 20
 * does not support one: the 95% interval on 2/20 runs from about 1% to 32%,
 * which still touches the base rate. Rule 4 also requires any such change to
 * beat the current model in sim against fixtures first. **Collect more procs,
 * then fit.** The proc rate is the binding constraint — 20 in 145 runs.
 *
 * ⚠ **The null here is not assumed, it is measured.** The enemy's own move
 * distribution over all 5067 corpus exchanges is paper 33.7% / rock 33.1% /
 * scissor 33.2% — flat to within a percent — so the uniform null and the
 * empirical null agree. Had the enemy been skewed, the CURRENT-exchange result
 * would have been the one at risk.
 *
 * ⚠ **An exchange is a state carrying a `use_move` event.** Every such capture
 * is followed by a duplicate with no events, and reading those as exchanges
 * makes "current" and "next" the SAME row — which is what a first pass at this
 * did, producing an identical 6/20 for both and hiding the whole finding.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { CORPUS_DIR } from "./corpus.js";

export type Move = "rock" | "paper" | "scissor";

export interface BlockedMoveObservation {
  run: string;
  /** The move the server named in `intuition_block`'s `data.blockedMove`. */
  blocked: string;
  /** The enemy's move in the exchange the proc fired in. */
  current: string | null;
  /** The enemy's move in the NEXT exchange, or null if the run ended. */
  next: string | null;
}

export interface BlockedMoveScope {
  observations: BlockedMoveObservation[];
  /** Enemy move counts over EVERY corpus exchange — the empirical null. */
  enemyMoveCounts: Record<string, number>;
  enemyExchanges: number;
  currentHits: number;
  currentN: number;
  nextHits: number;
  nextN: number;
  /** Expected hits under the enemy's own distribution, not under 1/3. */
  currentExpected: number;
  nextExpected: number;
}

interface RawState {
  data?: {
    events?: { type?: string; value?: unknown; data?: { blockedMove?: string } }[];
    run?: { players?: { lastMove?: string }[] };
  };
}

interface Exchange {
  events: NonNullable<RawState["data"]>["events"];
  enemyMove: string | null;
}

/**
 * ⚠ This reads the RAW captures, not `loadCorpus()`. `CorpusState` keeps
 * `data.run` and drops `data.events` entirely, and `intuition_block` lives in
 * `data.events` — so the normalised corpus cannot answer this question at all.
 * That is the reason for the duplicate walk here rather than an oversight.
 *
 * An exchange is a capture carrying a `use_move` event; see the header.
 */
function exchangesOf(dir: string): Exchange[] {
  const out: Exchange[] = [];
  let files: string[];
  try {
    files = readdirSync(dir).filter((f) => /^state-\d+\.json$/.test(f)).sort();
  } catch {
    return out;
  }
  for (const f of files) {
    let s: RawState;
    try {
      s = JSON.parse(readFileSync(join(dir, f), "utf8")) as RawState;
    } catch {
      continue;
    }
    const events = s?.data?.events ?? [];
    if (!events.some((e) => e.type === "use_move")) continue;
    out.push({ events, enemyMove: s?.data?.run?.players?.[1]?.lastMove ?? null });
  }
  return out;
}

export function blockedMoveScope(root: string = CORPUS_DIR): BlockedMoveScope {
  const observations: BlockedMoveObservation[] = [];
  const enemyMoveCounts: Record<string, number> = {};
  let enemyExchanges = 0;

  let runs: string[];
  try {
    runs = readdirSync(root).filter((d) => d.startsWith("run-")).sort();
  } catch {
    runs = [];
  }

  for (const run of runs) {
    const ex = exchangesOf(join(root, run));
    for (const e of ex) {
      if (!e.enemyMove) continue;
      enemyMoveCounts[e.enemyMove] = (enemyMoveCounts[e.enemyMove] ?? 0) + 1;
      enemyExchanges++;
    }
    for (let i = 0; i < ex.length; i++) {
      const blk = ex[i]!.events!.find((v) => v.type === "intuition_block");
      if (!blk) continue;
      const blocked = blk.data?.blockedMove ?? (typeof blk.value === "string" ? blk.value : "");
      observations.push({
        run,
        blocked,
        current: ex[i]!.enemyMove,
        next: ex[i + 1]?.enemyMove ?? null,
      });
    }
  }

  const tally = (key: "current" | "next") => {
    let hits = 0, n = 0, expected = 0;
    for (const o of observations) {
      const v = o[key];
      if (v == null) continue;
      n++;
      if (v === o.blocked) hits++;
      expected += enemyExchanges > 0 ? (enemyMoveCounts[o.blocked] ?? 0) / enemyExchanges : 0;
    }
    return { hits, n, expected };
  };

  const cur = tally("current");
  const nxt = tally("next");
  return {
    observations,
    enemyMoveCounts,
    enemyExchanges,
    currentHits: cur.hits, currentN: cur.n, currentExpected: cur.expected,
    nextHits: nxt.hits, nextN: nxt.n, nextExpected: nxt.expected,
  };
}
