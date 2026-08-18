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

export interface FishingCorpusResponse {
  file: string;
  kind: FishingActionKind;
  completeCid: boolean;
  successCid: boolean | null;
}

export interface FishingCast {
  docId: string;
  responses: FishingCorpusResponse[];
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
      data?: { doc?: { docId?: string; COMPLETE_CID?: boolean; SUCCESS_CID?: boolean | null } };
    };
    const docId = body.data?.doc?.docId;
    if (typeof docId !== "string") continue; // not a fishing action response (e.g. a probe dump) — skip

    const cast = byDoc.get(docId) ?? { docId, responses: [] };
    cast.responses.push({
      file,
      kind: classifyMessage(body.message),
      completeCid: body.data!.doc!.COMPLETE_CID === true,
      successCid: body.data!.doc!.SUCCESS_CID ?? null,
    });
    byDoc.set(docId, cast);
  }

  return [...byDoc.values()];
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
