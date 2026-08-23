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
  /**
   * [session 64] `consumablesUsed` on this state — the server's own running
   * count. Carried so an audit can tell a turn an oil was consumed BEFORE from
   * one it was not, which is the difference between a rule being violated and a
   * rule not applying. The item response itself is skipped (see ITEM_MESSAGE),
   * so the count is what makes the consume visible in the trace at all.
   */
  consumablesUsed: number;
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
/**
 * [session 64] `use_fishing_item`'s response. NOT A TURN, and skipped for the
 * same reason `LOOT_MESSAGE` is: it repeats the preceding turn's move fields
 * verbatim rather than reporting a new move.
 *
 * Confirmed on the first live oil consume (cast 13019015, state-008): the
 * response carries `FOCUS_STAMINA_DIFF` and `use_fishing_item` events and NO
 * `FISH_MOVED`, with `fishPosition`, `previousFishPosition`, `lastMovePath`,
 * `hand`, `discard` and `nextCardIndex` all identical to state-007's.
 *
 * Counting it as a turn breaks position continuity — its
 * `previousFishPosition` is the turn-before-last's, not the last turn's — so
 * `continuous` goes false and `isCleanTrace` drops the WHOLE cast. That would
 * have silently excluded every oil cast from the movement corpus from here on,
 * which is exactly backwards: §4b pools movement quantities across the oil arm
 * precisely because an oil changes what we spend, not what the fish does.
 *
 * Same trap as session 63's `shield.currentMax` dead end, in fishing costume:
 * a response that RE-REPORTS its predecessor's state read as a fresh event.
 *
 * The one thing skipping costs: the trace no longer contains the mid-cast
 * snapshot in which the meter reads its post-restore value. The restoration is
 * still visible — the next real turn's `focusMeter` reflects it — but a reader
 * reconstructing the focus budget turn-by-turn will see it rise without a
 * local cause and should consult the raw fixture.
 */
const ITEM_MESSAGE = "Item used successfully.";

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
 *
 * ⚠ **[session 84 §0b] FILE ORDER IS THE SEQUENCE. The server's timestamps
 * are not, and sorting a cast's states by them REORDERS the cast** — within
 * one cast they tie, so any sort on them is arbitrary. This nearly shipped as
 * a published table: a focus-oil detector sorted on `createdAt` reported 140
 * of 148 casts firing an oil where the file-ordered truth is 13, and what
 * caught it was the number being implausible rather than a check.
 *
 * The one legitimate use of the timestamp is the opposite question — dating a
 * WHOLE cast, where `doc.createdAt` is constant across its states (148/148)
 * and is the only per-cast clock the committed fixtures carry. That is
 * `src/sim/fishing/castEra.ts`'s `loadCastCreatedAt`, and it deliberately
 * takes the FIRST state's value per `docId` rather than sorting on it.
 */
export function loadCastTraces(root: string = join("fixtures", "fishing-casts")): CastTrace[] {
  const files = walkStateFiles(root).sort();
  const byDoc = new Map<string, { docId: string; entries: { file: string; body: Record<string, unknown> }[] }>();
  /** [session 68] Terminal events that arrive on a `use_fishing_item` response — see the ITEM_MESSAGE branch. */
  const terminalFromItems = new Map<string, { caught: boolean; escaped: boolean }>();

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
    if (body.message === ITEM_MESSAGE) {
      // ---- [session 68 §2] AN ITEM RESPONSE IS NOT A TURN, BUT IT CAN END
      //      THE CAST -------------------------------------------------------
      //
      // This was a bare `continue`, which dropped the response before its
      // EVENTS were ever read. That was correct for everything the skip was
      // built for — the item response repeats the previous turn's move fields
      // and must not become a turn — and silently wrong for one thing: a
      // lethal Mid Relaxing Oil kills the fish, so `FISH_DIED` arrives on an
      // item response and nowhere else.
      //
      // Consequence, measured: `loadCastTraces()` reported 23 catches where
      // the corpus reported 26. **Every fish killed by an oil was invisible to
      // every trace-based statistic**, and the lethal trigger is the shipped
      // policy, so the undercount was going to grow with each batch. Same root
      // as the `CRIT_HIT` miss above: a rule derived from how casts used to
      // end, dated by a new way for them to end.
      //
      // The terminal flag is taken; the turn is still not.
      const evs = (body as { data?: { events?: { type?: string }[] } }).data?.events ?? [];
      if (evs.some((e) => e.type === "FISH_DIED") || evs.some((e) => e.type === "FISH_ESCAPED")) {
        const t = terminalFromItems.get(docId) ?? { caught: false, escaped: false };
        if (evs.some((e) => e.type === "FISH_DIED")) t.caught = true;
        if (evs.some((e) => e.type === "FISH_ESCAPED")) t.escaped = true;
        terminalFromItems.set(docId, t);
      }
      continue;
    }
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
              // [session 68 §2] **`CRIT_HIT` IS A HIT.** This read
              // `e.type === "HIT"` alone, so the server's crit event was
              // scored as a MISS by every offline audit built on this trace.
              // It went unnoticed for as long as it did because `CRIT_HIT` had
              // never appeared: 1 occurrence in 484 recorded card plays across
              // 114 casts, and it arrived in session 68's own batch.
              //
              // The live path is unaffected and always was — `liveFishing.ts`
              // derives its `realizedHit` from `newDoc.data.fishHp < fishHp`,
              // an HP-delta test that counts a crit correctly. So
              // `data/ringPrediction.jsonl` and §19's verdict never saw this.
              hit: events.some((e) => e.type === "HIT" || e.type === "CRIT_HIT"),
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
        consumablesUsed: Number(d.consumablesUsed ?? 0),
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
    // [session 68] Fold in a terminal event that arrived on an item response.
    const fromItem = terminalFromItems.get(docId);
    traces.push({
      docId,
      cards,
      turns,
      caught: caught || (fromItem?.caught ?? false),
      escaped: escaped || (fromItem?.escaped ?? false),
      hasStart,
      continuous,
    });
  }

  return traces;
}

/** A trace usable for trajectory analysis and replay: starts at turn 0 and never breaks position continuity. */
export function isCleanTrace(t: CastTrace): boolean {
  return t.hasStart && t.continuous && t.turns.length >= 2;
}
