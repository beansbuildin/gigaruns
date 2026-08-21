/**
 * src/sim/fishingCorpus.ts — [session 28, CODEXREVIEW #1/#5] the ONE place
 * allowed to walk committed fishing fixtures and group them into real
 * casts. Session 26/27's own corpus audits counted fixture DIRECTORIES and
 * raw response-document FILES as if they were casts and turns — they are
 * not. A directory is one process invocation's output, not one cast: a
 * killed-and-resumed process can write a SECOND distinct `docId` into the
 * same directory (Codex found this live: cast `12923189`'s directory has
 * two different turn-0 transitions ~5 minutes apart, from two different
 * process runs). The real, stable identity a cast carries across every
 * response it produces is `data.doc.docId` — that's what this groups by.
 *
 * Direct recount against the corpus this loader is built from (session 28):
 * 30 non-empty committed directories, 50 distinct casts (docId), 225
 * response documents, 169 `play_cards` (card-play) turns, 7 caught casts
 * (14%). All future fishing-corpus audits should call `loadFishingCorpus()`
 * rather than re-deriving a directory or file count by hand — see
 * `mineFishPatterns.ts`'s header comment for why THAT script's own counts
 * (which read `data/fish-patterns.jsonl`, a flat transition log keyed by
 * `castId` from turn one) were never affected by this bug in the first
 * place; this loader exists for anyone auditing the raw fixture tree
 * instead.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type FishingActionKind = "start_run" | "play_cards" | "loot" | "unknown";

/**
 * Response `message` text -> action kind. Confirmed against the full
 * committed corpus (session 28): every response so far carries exactly one
 * of these three strings. Anything else is reported as `"unknown"` rather
 * than guessed at — CLAUDE.md §2, don't invent meaning for an unconfirmed
 * shape.
 */
function classifyMessage(message: string | undefined): FishingActionKind {
  switch (message) {
    case "Game started successfully.":
      return "start_run";
    case "Cards played successfully.":
      return "play_cards";
    case "Card added to deck successfully.":
      return "loot";
    default:
      return "unknown";
  }
}

/**
 * [session 30, CORRECTED session 31] The catch payload, read from
 * `data.events[]`'s `FISH_DIED` entry: `fixtures/fishing-casts/live/
 * cast-2026-08-16-01-57-02/state-017.json`. `doc.data.caughtFish` carries the
 * SAME object (session 15's finding, still accurate) and is a valid source
 * too — session 30's claim that it's "never populated" was checked directly
 * against the fixtures this session and found FALSE, corrected in
 * DECISIONS.md 2026-08-18 (session 31). `FISH_DIED` is used here anyway
 * because it fires exactly once (the kill turn), while `caughtFish` persists
 * across every later response in the cast (same shape as `nextPosition`) —
 * a one-shot event is the simpler signal for grouping-by-response logic like
 * this loader's, not because the doc field is unreliable.
 */
export interface CaughtFish {
  gameItemId: number;
  name: string;
  rarity: number;
}

export interface FishingCorpusResponse {
  file: string;
  kind: FishingActionKind;
  completeCid: boolean;
  successCid: boolean | null;
  /** `null` unless this response's `data.events[]` contains a `FISH_DIED` entry. */
  caughtFish: CaughtFish | null;
  /**
   * ── [session 64 §1] THE BOARD STATE THIS RESPONSE REPORTS ────────────────
   *
   * The four scalars an oil TRIGGER is a function of, carried on the response
   * so a corpus analysis does not have to re-open and re-parse the same files
   * this loader just read. Additive: nothing above changes, and every count
   * `summarizeFishingCorpus` produces is untouched.
   *
   * `updatedAt` is here for ORDER, and that is not a convenience. A cast's
   * responses arrive in filesystem-walk order, and a killed-and-resumed
   * process writes later turns of the same `docId` into a different directory
   * (this file's header, cast 12923189) — so file order is not turn order in
   * general. Any question of the form "was there a turn AFTER this one" has to
   * sort on something the SERVER stamped, which is this.
   */
  board: FishingBoardScalars;
  /** Server-stamped `doc.updatedAt`. The only sound ordering key within a cast — see `board`. */
  updatedAt: string;
}

/** The scalars an oil trigger reads. Named for what they are on the wire, not renamed to match `OilTimingState`. */
export interface FishingBoardScalars {
  fishHp: number;
  fishMaxHp: number;
  focusMeter: number;
  focusMeterMax: number;
}

export interface FishingCast {
  docId: string;
  responses: FishingCorpusResponse[];
  /**
   * ── [session 61 §4b] THE OIL FLAG ────────────────────────────────────────
   *
   * Highest `consumablesUsed` seen on any board state in this cast. Zero means
   * the cast was played with no consumable of any kind; anything above zero
   * means at least one was spent, which for this account means an oil.
   *
   * **Derived, not written.** The brief asked for "a flag on the cast record,
   * not a deletion and not a separate file" — and the strongest version of
   * that turns out not to be a new field the live loop has to remember to set.
   * `consumablesUsed` and `fishingConsumableSlotUsed[3]` are already on EVERY
   * captured board state, in every fixture, back to the first cast ever
   * recorded. So the flag is read off the capture instead. Three consequences,
   * all of them the point:
   *
   *   - It cannot be forgotten. A cast recorded by a future code path that
   *     nobody remembered to instrument still carries it, because the SERVER
   *     puts it there.
   *   - It applies RETROACTIVELY. Every one of the 94 existing casts is
   *     classified without re-capturing anything — and doing so immediately
   *     found one the brief said could not exist (12975152, `consumablesUsed:
   *     1` from before its first captured state). A written flag would have
   *     started at zero and never found it.
   *   - It is a flag, so an excluded cast can be reconsidered. Nothing is
   *     deleted and no cast moves to another file.
   *
   * **What it does NOT tell you: WHICH oil.** The board state counts
   * consumables and marks slots; it does not name the item. Item identity is
   * recorded at spend time by `liveFishing.ts` on the per-turn record
   * (`oilItemIdsUsed`), which is the only place that knows it. So this field
   * answers "does this cast pool with the non-oil arm?" — the §4b question —
   * and the per-turn record answers "which oil, and when".
   *
   * **How to use it, per §4b:** outcome metrics (catch rate, per-cast
   * outcomes, oil comparisons, and the 1.667 opening focus-spend mean —
   * denominated in a budget the Focus Oil makes bigger) split into separate
   * arms on this field. Movement-model quantities (ring model, step classes,
   * mined patterns, matcher prior pi_0) POOL across it, because both oils
   * change what we spend and not what the fish does.
   */
  consumablesUsed: number;
  /** True iff `consumablesUsed > 0` — the oil-arm predicate, named so call sites read as intent. */
  oilEra: boolean;
  /** Union of `fishingConsumableSlotUsed` across the cast's states. Three slots, per SPEC-fishing §4a. */
  slotsUsed: boolean[];
}

/**
 * Recursively collects every per-turn response file under `root`, skipping
 * `raw/` (mirrors every redacted file unredacted — counting both would
 * double every response) and non-response fixtures that live alongside the
 * per-cast directories (`cards.json`, `cast.json`, `state.json`,
 * `item-metadata-sample.json`, `*.har` — catalog/single-capture fixtures,
 * not per-turn action responses; only files matching `state-*.json` are the
 * latter, per `FixtureWriter`'s own naming convention in `scripts/
 * liveRun.ts`/`scripts/liveFishing.ts`).
 */
function walkResponseFiles(root: string): string[] {
  const out: string[] = [];
  let entries: import("node:fs").Dirent[];
  try {
    entries = readdirSync(root, { withFileTypes: true });
  } catch {
    return out; // root doesn't exist — an empty corpus, not an error
  }
  for (const e of entries) {
    if (e.name === "raw") continue;
    const full = join(root, e.name);
    if (e.isDirectory()) {
      out.push(...walkResponseFiles(full));
      continue;
    }
    if (e.name.startsWith("state-") && e.name.endsWith(".json")) out.push(full);
  }
  return out;
}

/**
 * [session 64] NaN, not 0, for a missing scalar. A board field this loader
 * cannot find is UNKNOWN, and 0 is a meaningful value for both `fishHp` (dead
 * fish) and `focusMeter` (the Focus trigger's exact condition) — defaulting to
 * it would manufacture trigger firings out of parse failures. NaN fails every
 * comparison instead, which is the safe direction. All 522 committed responses
 * carry all four fields today; this is a guard, not a live code path.
 */
function numOr(v: unknown, fallback: number): number {
  return typeof v === "number" ? v : fallback;
}

/**
 * Loads every committed fishing fixture under `root` (default
 * `fixtures/fishing-casts`) and groups response documents by
 * `data.doc.docId` — see this file's header comment for why that, and not
 * the directory a response happens to live in, is the real cast boundary.
 */
export function loadFishingCorpus(root: string = join("fixtures", "fishing-casts")): FishingCast[] {
  const files = walkResponseFiles(root);
  const byDoc = new Map<string, FishingCast>();

  for (const file of files) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(file, "utf8"));
    } catch {
      continue; // unparsable — skip, don't fail the whole corpus over one bad file
    }
    const body = parsed as {
      message?: string;
      data?: {
        doc?: {
          docId?: string;
          COMPLETE_CID?: boolean;
          SUCCESS_CID?: boolean | null;
          updatedAt?: string;
          data?: {
            consumablesUsed?: number;
            fishingConsumableSlotUsed?: boolean[];
            fishHp?: number;
            fishMaxHp?: number;
            focusMeter?: number;
            focusMeterMax?: number;
          };
        };
        events?: { type?: string; data?: { fish?: CaughtFish } }[];
      };
    };
    const docId = body.data?.doc?.docId;
    if (typeof docId !== "string") continue; // not a fishing action response (e.g. a probe dump) — skip

    const fishDied = body.data?.events?.find((e) => e.type === "FISH_DIED");
    const caughtFish: CaughtFish | null = fishDied?.data?.fish
      ? { gameItemId: fishDied.data.fish.gameItemId, name: fishDied.data.fish.name, rarity: fishDied.data.fish.rarity }
      : null;

    const cast = byDoc.get(docId) ?? {
      docId,
      responses: [],
      consumablesUsed: 0,
      oilEra: false,
      slotsUsed: [false, false, false],
    };
    // [session 61 §4b] MAX, not last: `consumablesUsed` is a running count
    // within a cast, and a cast's final captured state is not guaranteed to be
    // its last state (a run can end on an error dump). Taking the max cannot
    // under-count, which is the safe direction — an oil cast wrongly pooled
    // into the non-oil arm is the failure that silently biases an outcome
    // metric; a non-oil cast wrongly excluded merely costs a data point.
    const used = body.data?.doc?.data?.consumablesUsed;
    if (typeof used === "number" && used > cast.consumablesUsed) cast.consumablesUsed = used;
    const slots = body.data?.doc?.data?.fishingConsumableSlotUsed;
    if (Array.isArray(slots)) {
      for (let i = 0; i < cast.slotsUsed.length && i < slots.length; i++) {
        if (slots[i] === true) cast.slotsUsed[i] = true;
      }
    }
    cast.oilEra = cast.consumablesUsed > 0 || cast.slotsUsed.some((v) => v);
    const d = body.data?.doc?.data;
    cast.responses.push({
      file,
      kind: classifyMessage(body.message),
      completeCid: body.data!.doc!.COMPLETE_CID === true,
      successCid: body.data!.doc!.SUCCESS_CID ?? null,
      caughtFish,
      board: {
        fishHp: numOr(d?.fishHp, Number.NaN),
        fishMaxHp: numOr(d?.fishMaxHp, Number.NaN),
        focusMeter: numOr(d?.focusMeter, Number.NaN),
        focusMeterMax: numOr(d?.focusMeterMax, Number.NaN),
      },
      updatedAt: typeof body.data?.doc?.updatedAt === "string" ? body.data.doc.updatedAt : "",
    });
    byDoc.set(docId, cast);
  }

  return [...byDoc.values()];
}

/**
 * [session 62 §1b] The THREE arms, not two.
 *
 * `oilEra` answers "did this cast spend a consumable" and is derived from the
 * server's own `consumablesUsed`, which is why it cannot be forgotten. It
 * cannot see a third case that partial stock makes routine: a cast in which the
 * `on-demand` policy WANTED an oil and the account held none.
 *
 *   - `"oil"`       — a consumable was spent. The oil arm.
 *   - `"non-oil"`   — nothing spent, nothing wanted-and-missed. The clean
 *                     control arm.
 *   - `"policy-dry"` — a trigger fired against an empty bag at least once.
 *                     **Belongs to NEITHER arm.** It is not an oil cast, and
 *                     it is not a clean non-oil cast either, because the policy
 *                     that played it was the oil policy running dry.
 *
 * `policy-dry` DELIBERATELY outranks `oil`. A cast that spent one oil and then
 * wanted a second it did not have is still a cast the policy ran dry during,
 * and pooling it into the oil arm would measure a policy nobody ran. Keeping it
 * out of both is the conservative direction and costs only a data point; the
 * failure in the other direction is a rate that silently means nothing, which
 * is what the dead era cost and what took 40 casts to notice.
 *
 * `dryCastIds` comes from `loadDryCastIds` (`src/strategy/fishing/
 * oilCastState.ts`). An empty set — the normal state today, since no cast has
 * ever run the policy dry — makes this a two-way split, exactly as before.
 */
export type OilArm = "oil" | "non-oil" | "policy-dry";

export function classifyOilArm(cast: FishingCast, dryCastIds: ReadonlySet<string>): OilArm {
  if (dryCastIds.has(cast.docId)) return "policy-dry";
  return cast.oilEra ? "oil" : "non-oil";
}

export interface FishingCorpusSummary {
  casts: number;
  responseDocs: number;
  playTurns: number;
  caught: number;
  escaped: number;
  /** A cast whose responses never include one with `COMPLETE_CID: true` — a process left mid-cast, not a terminal outcome. */
  incomplete: number;
}

/** Turns a loaded corpus into the headline numbers — the ones any audit should quote instead of a directory/file count. */
export function summarizeFishingCorpus(casts: FishingCast[]): FishingCorpusSummary {
  let responseDocs = 0;
  let playTurns = 0;
  let caught = 0;
  let escaped = 0;
  let incomplete = 0;

  for (const cast of casts) {
    responseDocs += cast.responses.length;
    playTurns += cast.responses.filter((r) => r.kind === "play_cards").length;
    const terminal = cast.responses.find((r) => r.completeCid);
    if (!terminal) {
      incomplete++;
      continue;
    }
    if (terminal.successCid) caught++;
    else escaped++;
  }

  return { casts: casts.length, responseDocs, playTurns, caught, escaped, incomplete };
}

/**
 * [session 64] Completed casts' outcomes, OLDEST FIRST — the input
 * `evaluateZeroStreak` has always documented and never been given.
 *
 * The tripwire's own header says a rule nobody computes is "not a safeguard;
 * it is a sentence about one", and until this session that was still true of
 * it: `evaluateZeroStreak` was called from tests and from nowhere else, so the
 * live loop could not have tripped it. It needs cast outcomes in chronological
 * order, and nothing produced them — `loadFishingCorpus` returns casts in
 * filesystem-walk order, which is not time order.
 *
 * Ordering is by each cast's EARLIEST server-stamped `updatedAt`, which is the
 * cast's start. A cast is dropped when it has no `COMPLETE_CID: true` response
 * at all: `evaluateZeroStreak`'s contract is explicit that a process killed
 * mid-cast is not evidence about the fishery and must not be counted as a miss.
 */
export function castOutcomesChronological(casts: readonly FishingCast[]): boolean[] {
  return casts
    .map((c) => {
      const terminal = c.responses.find((r) => r.completeCid);
      if (!terminal) return null;
      const startedAt = c.responses.reduce((min, r) => (r.updatedAt !== "" && r.updatedAt < min ? r.updatedAt : min), "\uffff");
      return { startedAt, caught: terminal.successCid === true };
    })
    .filter((x): x is { startedAt: string; caught: boolean } => x !== null)
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
    .map((x) => x.caught);
}
