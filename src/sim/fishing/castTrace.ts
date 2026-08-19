/**
 * src/sim/fishing/castTrace.ts — [session 47, brief §1b]
 *
 * The THIRD fishing corpus view, and deliberately so. The two that existed
 * answer different questions and neither carries what an off-policy replay
 * needs:
 *
 *  - `src/sim/fishing/transitionCorpus.ts` reads `data/fish-patterns.jsonl` —
 *    positions only. No HP, no hand, no deck. Enough to fit a movement model,
 *    not enough to re-run a policy.
 *  - `src/sim/fishingCorpus.ts` groups raw fixture responses by `docId` but
 *    projects each one down to `{kind, completeCid, successCid, caughtFish}` —
 *    a run-visibility summary, not a state trace.
 *
 * This one keeps the whole per-turn game state off `data.doc.data`
 * (`fishPosition`, `previousFishPosition`, `fishHp`, `focusPoint`,
 * `focusMeter`, `playerHp` = mana, `hand`, `fullDeck`, `nextCardIndex`,
 * `deckCardData`) plus what `data.events[]` says actually happened on that
 * turn (the fish moved, the card hit or missed, the fish died or escaped).
 *
 * **Turn order within one response is FISH_MOVED -> CARD_PLAYED -> HIT /
 * FISH_HP_DIFF**, confirmed by reading `data.events[]` across the corpus. The
 * fish moves FIRST and the card then resolves against the cell it moved to.
 * That ordering is what makes "predict the next position" the right problem
 * shape, and it is also why a card played on turn t cannot influence the fish's
 * move on that same turn t — only, if at all, its move on turn t+1. Testing
 * exactly that is `scripts/auditMovementIndependence.ts`'s whole job.
 *
 * Hygiene, learned the expensive way (session 29 CODEXREVIEW #5, session 28
 * CODEXREVIEW #1): one fixture DIRECTORY can hold several casts, and one cast
 * can span two directories, so `docId` is the cast boundary — never the
 * directory. `loot` responses ("Card added to deck successfully.") repeat the
 * final state verbatim and are dropped, otherwise every catch looks like a
 * continuity break. `raw/` is skipped for the same reason `fishingCorpus.ts`
 * skips it: it mirrors every file unredacted, and counting both double-counts
 * the corpus.
 *
 * On the committed corpus as of session 47 this yields **68 clean traces /
 * 279 play turns / 7 catches**, which reconciles exactly with the figures the
 * other two views report (STATE.md's "0/279 off-ring" and "7/69 = 10.1%").
 * The 69th cast (`12975152`) is session 45's resumed cast: it has no
 * `start_run` response, so it has no initial state to replay from, and it is
 * reported separately rather than silently dropped.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { Cell } from "./geometry.js";

export interface TraceCard {
  id: number;
  manaCost: number;
  hitZones: number[];
  critZones: number[];
  hitEffects: { type: string; amount: number }[];
  missEffects: { type: string; amount: number }[];
  /**
   * [session 48] Crit damage. A crit fires an ordinary `HIT` event (session
   * 47 — there is no `CRIT` event type), so the ONLY way to tell a crit from
   * a hit is that the damage matches this instead of `hitEffects`, at a fish
   * cell inside the translated `critZones`. See `stateFieldAudit.ts`.
   */
  critEffects: { type: string; amount: number }[];
}

export interface CastTurn {
  file: string;
  /** 0 is the `start_run` response (the cast's initial state, before any card). */
  index: number;
  fishPosition: Cell;
  previousFishPosition: Cell;
  /**
   * [session 48] The server's own account of HOW the fish got here this turn:
   * 1-based row-major cell indices, one per UNIT step, ending on
   * `fishPosition`. `null` on turn 0 and on any doc that omits the field.
   *
   * This is the field that corrected FACT 1. See `movePathAudit.ts`.
   */
  lastMovePath: number[] | null;
  /**
   * [session 48] The server's PRE-ROLLED next move, same encoding as
   * `lastMovePath`. Non-null on only ~1.5% of state docs and nobody knows
   * why. QUESTIONS.md §17; `movePathAudit.ts`'s `auditNextMovePaths`.
   */
  nextMovePath: number[] | null;
  /** [session 48] Endpoint of `nextMovePath`. Null whenever that is null. */
  nextPosition: Cell | null;
  fishHp: number;
  fishMaxHp: number;
  /** `playerHp` on the wire; it is the mana pool, not health. */
  mana: number;
  manaMax: number;
  focusPoint: Cell;
  focusMeter: number;
  focusMeterMax: number;
  gridSize: number;
  hand: number[];
  fullDeck: number[];
  nextCardIndex: number;
  discard: number[];
  /**
   * What the play that PRODUCED this state did. `null` on turn 0 — no card
   * was played to reach the initial state.
   */
  play: {
    /** Hand-relative index sent, off `CARD_PLAYED.value`. */
    handIndex: number;
    /** True when a `HIT` event fired. `CARD_PLAYED.data.result` agrees on every turn in the corpus. */
    hit: boolean;
    /** Signed `FISH_HP_DIFF.value`: positive on a hit (damage), negative on a miss (the fish regenerates). */
    fishHpDiff: number;
  } | null;
  /**
   * The hand the server dealt when this turn emptied the hand, off the
   * `NEW_HAND` event; `null` on every other turn.
   *
   * **This is the only reconstructible source of future draws, and the
   * session-47 brief was wrong about that.** The brief asserted "`fullDeck`
   * plus `nextCardIndex` reconstructs the exact sequence"; checked against the
   * corpus, **0 of 56 refills and 1 of 69 opening hands** match a `fullDeck`
   * slice. `fullDeck` is a canonical, sorted deck list — the real draw pile is
   * a server-side shuffle that never appears on the wire.
   *
   * The replay survives anyway, on firmer ground: across all 282 recorded
   * plays, with **zero exceptions**, a play removes exactly one card by hand
   * index and the hand refills to 3 exactly when it empties. Since every turn
   * plays exactly one card, a counterfactual policy empties the hand on the
   * SAME turn no matter which card it picks — so the refill lands at the same
   * turn index and its contents are this recorded value. Card ORDER within a
   * 3-card block is free; the blocks themselves are pinned.
   */
  newHand: number[] | null;
  fishDied: boolean;
  fishEscaped: boolean;
}

export interface CastTrace {
  docId: string;
  /** Card definitions for this cast, off `deckCardData` on the first turn. */
  cards: Map<number, TraceCard>;
  turns: CastTurn[];
  caught: boolean;
  escaped: boolean;
  /** False when the cast has no `start_run` response — resumable for analysis, not replayable. */
  hasStart: boolean;
  /** False when some turn's `previousFishPosition` disagrees with the prior turn's `fishPosition`. */
  continuous: boolean;
}

const LOOT_MESSAGE = "Card added to deck successfully.";
const START_MESSAGE = "Game started successfully.";

function walkStateFiles(root: string): string[] {
  const out: string[] = [];
  let entries: import("node:fs").Dirent[];
  try {
    entries = readdirSync(root, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.name === "raw") continue;
    const full = join(root, e.name);
    if (e.isDirectory()) {
      out.push(...walkStateFiles(full));
      continue;
    }
    if (e.name.startsWith("state-") && e.name.endsWith(".json")) out.push(full);
  }
  return out;
}

function cellOf(v: unknown): Cell | null {
  return Array.isArray(v) && typeof v[0] === "number" && typeof v[1] === "number" ? { x: v[0], y: v[1] } : null;
}

interface RawEvent {
  type?: string;
  value?: unknown;
  data?: { result?: number };
}

function numberArray(v: unknown): number[] | null {
  return Array.isArray(v) && v.every((x) => typeof x === "number") ? (v as number[]) : null;
}

/**
 * Loads every committed fishing fixture under `root` into per-cast state
 * traces. Files are visited in sorted path order, which is chronological —
 * directories are timestamped and `state-NNN.json` is zero-padded.
 */
export function loadCastTraces(root: string = join("fixtures", "fishing-casts")): CastTrace[] {
  const files = walkStateFiles(root).sort();
  const byDoc = new Map<string, { docId: string; entries: { file: string; body: Record<string, unknown> }[] }>();

  for (const file of files) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(file, "utf8"));
    } catch {
      continue;
    }
    const body = parsed as { message?: string; data?: { doc?: { docId?: string; data?: Record<string, unknown> } } };
    const docId = body.data?.doc?.docId;
    if (typeof docId !== "string") continue;
    if (!body.data?.doc?.data) continue;
    if (body.message === LOOT_MESSAGE) continue; // repeats the final state verbatim
    const bucket = byDoc.get(docId) ?? { docId, entries: [] };
    bucket.entries.push({ file, body: body as Record<string, unknown> });
    byDoc.set(docId, bucket);
  }

  const traces: CastTrace[] = [];
  for (const { docId, entries } of byDoc.values()) {
    const turns: CastTurn[] = [];
    const cards = new Map<number, TraceCard>();
    let caught = false;
    let escaped = false;
    let continuous = true;
    let prevPos: Cell | null = null;
    let bad = false;

    entries.forEach(({ file, body }, index) => {
      const b = body as {
        message?: string;
        data?: { doc?: { data?: Record<string, unknown> }; events?: RawEvent[] };
      };
      const d = b.data!.doc!.data!;
      const pos = cellOf(d.fishPosition);
      const prev = cellOf(d.previousFishPosition);
      const focus = cellOf(d.focusPoint);
      if (!pos || !prev || !focus) {
        bad = true;
        return;
      }
      if (cards.size === 0 && Array.isArray(d.deckCardData)) {
        for (const c of d.deckCardData as TraceCard[]) cards.set(c.id, c);
      }
      const events = b.data!.events ?? [];
      const cardPlayed = events.find((e) => e.type === "CARD_PLAYED");
      const hpDiff = events.find((e) => e.type === "FISH_HP_DIFF");
      const play =
        cardPlayed && typeof cardPlayed.value === "number"
          ? {
              handIndex: cardPlayed.value,
              hit: events.some((e) => e.type === "HIT"),
              fishHpDiff: typeof hpDiff?.value === "number" ? hpDiff.value : 0,
            }
          : null;
      if (events.some((e) => e.type === "FISH_DIED")) caught = true;
      if (events.some((e) => e.type === "FISH_ESCAPED")) escaped = true;
      if (prevPos && (prev.x !== prevPos.x || prev.y !== prevPos.y)) continuous = false;
      prevPos = pos;

      turns.push({
        file,
        index,
        fishPosition: pos,
        previousFishPosition: prev,
        lastMovePath: Array.isArray(d.lastMovePath) ? (d.lastMovePath as number[]) : null,
        nextMovePath: Array.isArray(d.nextMovePath) ? (d.nextMovePath as number[]) : null,
        nextPosition: cellOf(d.nextPosition),
        fishHp: Number(d.fishHp),
        fishMaxHp: Number(d.fishMaxHp),
        mana: Number(d.playerHp),
        manaMax: Number(d.playerMaxHp),
        focusPoint: focus,
        focusMeter: Number(d.focusMeter),
        focusMeterMax: Number(d.focusMeterMax),
        gridSize: Number(d.gridSize),
        hand: Array.isArray(d.hand) ? (d.hand as number[]) : [],
        fullDeck: Array.isArray(d.fullDeck) ? (d.fullDeck as number[]) : [],
        nextCardIndex: Number(d.nextCardIndex),
        discard: Array.isArray(d.discard) ? (d.discard as number[]) : [],
        play,
        newHand: numberArray(events.find((e) => e.type === "NEW_HAND")?.value),
        fishDied: events.some((e) => e.type === "FISH_DIED"),
        fishEscaped: events.some((e) => e.type === "FISH_ESCAPED"),
      });
    });

    if (bad || turns.length === 0) continue;
    const hasStart = (entries[0]!.body as { message?: string }).message === START_MESSAGE && turns[0]!.play === null;
    traces.push({ docId, cards, turns, caught, escaped, hasStart, continuous });
  }

  return traces;
}

/** A trace usable for trajectory analysis and replay: starts at turn 0 and never breaks position continuity. */
export function isCleanTrace(t: CastTrace): boolean {
  return t.hasStart && t.continuous && t.turns.length >= 2;
}
