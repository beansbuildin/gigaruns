/**
 * src/orchestrator/capture.ts — [session 78, §5 / CODEXAUG22REVIEW L4] the one
 * implementation of "write down what the server said."
 *
 * **Why this is a shared module and not two tidy copies.**
 * `FixtureWriter` and `RunLog` existed TWICE, independently — once in
 * `scripts/liveRun.ts` and once in `scripts/liveFishing.ts` — with the redaction
 * routine duplicated a third time alongside them. Every line of both copies was
 * the same except a filename prefix and a default directory.
 *
 * That is not a style problem. These two classes write the evidence that
 * everything else in this repo is built on, and one of the things they do is
 * REDACT. A redaction fix, a durability fix, or an atomicity fix applied to one
 * copy and not the other is a silent divergence in the two paths that produce
 * the corpus — and this repo has already been bitten by exactly that shape four
 * times (SPEC-fishing.md §4: a fix applied to one class and the sibling with the
 * identical field never re-scored). `src/api/redact.ts` exists because the noob
 * token rule held in five of six writers; this is the same lesson one level up.
 *
 * **What is deliberately NOT here.** The review also proposed thinning the JSONL
 * logs to "tag, action, status, room/turn, deltas". Refused: `logs/` is
 * gitignored and lossy already, and four Relaxing observations from session 69
 * survive only inside a derived report because the underlying record was never
 * written. Cutting the log is a bet about what future analysis will need, and
 * fixtures at ~73MB in a clean clone are not a cost worth paying in evidence.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

import { redactNoobToken } from "../api/redact.js";

/**
 * Every redaction rule that applies to a captured response, in one place.
 *
 * Three passes, and the order is not arbitrary: the address forms first (all
 * three cases, because the wire is inconsistent about them), then the client's
 * own JWT redactor — which is the ONLY thing holding the real token (session 28,
 * CODEXREVIEW #7: every prior caller passed the 8-char DISPLAY prefix, so most
 * of a real credential could have landed in a "redacted" fixture on a public
 * repo) — then the username keys, then the shared noob-token rule.
 */
export function redactCapture(
  raw: string,
  address: string,
  redactSecrets: (text: string) => string,
): string {
  let s = raw;
  for (const form of [address, address.toLowerCase(), address.toUpperCase()]) {
    if (form) s = s.split(form).join("0xUSER");
  }
  s = redactSecrets(s);
  s = s.replace(/("(?:[A-Za-z_]*[Uu]ser[Nn]ame[A-Za-z_]*)"\s*:\s*)"[^"]*"/g, '$1"<USER>"');
  // [session 54] See src/api/redact.ts — shared so this rule cannot hold in
  // five of six writers.
  return redactNoobToken(s);
}

/** Filesystem-safe UTC stamp, shared so two capture roots can never drift apart. */
export function stamp(): string {
  return new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19);
}

/**
 * One capture directory. Writes each response twice — the raw body under
 * `raw/` (gitignored) and the redacted body beside it (committed) — so the
 * redaction can always be re-derived and re-checked against the original.
 */
export class CaptureFixtureWriter {
  private n = 0;
  private readonly out: string;
  private readonly rawDir: string;

  constructor(
    private readonly address: string,
    private readonly redactSecrets: (text: string) => string,
    root: string,
    prefix: string,
  ) {
    this.out = join(root, `${prefix}-${stamp()}`);
    this.rawDir = join(this.out, "raw");
    mkdirSync(this.rawDir, { recursive: true });
  }

  /**
   * [session 36, CODEXAUDIT #1 fix] Returns the exact file name this write just
   * used (e.g. `state-023.json`) — the same tail `src/sim/corpus.ts`'s
   * `CorpusState.label` carries once this fixture is read back off disk.
   * Callers that need to name the exchange they just observed build it from
   * this return value plus `runName`, via `exchangeLabel`/`exchangeIdentity`,
   * the SAME derivation `opponentModelPersistence.ts`'s corpus bootstrap uses
   * — so the two can never compute a different identity for one exchange.
   *
   * The fishing copy returned `void`. Returning the name on both sides costs
   * nothing and removes a difference that was never intentional.
   */
  write(body: unknown): string {
    const tag = String(this.n).padStart(3, "0");
    const text = JSON.stringify(body, null, 2);
    const fileName = `state-${tag}.json`;
    writeFileSync(join(this.rawDir, fileName), text);
    writeFileSync(join(this.out, fileName), redactCapture(text, this.address, this.redactSecrets));
    this.n++;
    return fileName;
  }

  get dir(): string {
    return this.out;
  }

  /**
   * The directory name `loadCorpus()` later reads as `CorpusRun.name` — the
   * `run` half of this fixture's exchange identities.
   */
  get runName(): string {
    return basename(this.out);
  }
}

/** Structured JSONL logging — SPEC §7. One line per event, appended. */
export class CaptureRunLog {
  private readonly path: string;

  constructor(dir: string, prefix: string) {
    mkdirSync(dir, { recursive: true });
    this.path = join(dir, `${prefix}-${stamp()}.jsonl`);
  }

  write(entry: Record<string, unknown>): void {
    writeFileSync(this.path, JSON.stringify({ ts: new Date().toISOString(), ...entry }) + "\n", {
      flag: "a",
    });
  }

  get filePath(): string {
    return this.path;
  }
}
