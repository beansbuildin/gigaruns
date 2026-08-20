/**
 * scripts/rejectionAudit.ts — per-class first-attempt rejection rates and
 * request-gap bands for any dungeon run log.
 *
 * [session 53, brief §0d] Same discipline as session 51's
 * `reversalDispersion.ts`: the analysis that found a bug should be committed,
 * not re-derived by hand next time. This one found §21's real mechanism.
 *
 * TWO CLOCKS, and confusing them is the whole trap:
 *   - `sinceLastRequestMs` — what `RateLimiter`'s `MIN_GAP_MS` controls.
 *   - `sinceLastResponseMs` — what the SERVER's outstanding-token window is
 *     measured against, and the only one on which the reject/accept bands
 *     separate cleanly. They differ by one response latency (0.72-1.78s).
 *
 * ONE CAVEAT ON BOTH, stated because the numbers look more precise than they
 * are: `liveRun.ts` writes its `post` event BEFORE calling the client, and the
 * rate limiter sleeps INSIDE the client. Every gap here is therefore measured
 * to the DECISION, not to the packet. Historically the sleep on a first
 * attempt was ~0-0.2s, so the bands are close to the dispatch truth; after
 * session 53's `minGapSinceResponseMs` they are NOT — an empty-token POST now
 * logs at ~1.2s and dispatches at ~4.0s. To see the pacing itself, measure
 * `post` -> `post_response` instead (4.24-4.55s after the fix, 0.72-1.78s
 * before it, numeric-token POSTs unchanged at ~1.4s throughout).
 *
 * A note on dating effects, because this is how session 52 got it wrong: the
 * 2026-08-18 logs record `post_attempt_failed` with an EMPTY body, because
 * `serverErrorDetail` did not capture the server's text until session 47/51.
 * Their `reason` field is populated on both sides of that fix. Grepping for
 * "Invalid action token" therefore reports zero failures before 2026-08-19
 * and a flood after, which looks exactly like a server change and is not one.
 * **When a log field's first appearance coincides with the effect you are
 * dating, date the effect on a field that predates the fix.** This script
 * classifies on `reason`/`event`, never on the error text.
 *
 * Usage:
 *   npx tsx scripts/rejectionAudit.ts                 # every logs/run-*.jsonl
 *   npx tsx scripts/rejectionAudit.ts logs/run-X.jsonl [...]
 *   npx tsx scripts/rejectionAudit.ts --json
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/** How a POST addressed the server's action-token check. */
export type TokenClass = "empty" | "numeric";

export interface AttemptRecord {
  file: string;
  action: string;
  tokenClass: TokenClass;
  /** Gap to the preceding SUCCESSFUL response — the server-side clock. Null for the first post in a log. */
  sinceLastResponseMs: number | null;
  /** Gap to the preceding event of any kind, including a failed attempt — the client-side pacing clock. */
  sinceLastRequestMs: number | null;
  /** True when the very next log event was `post_attempt_failed`. */
  failed: boolean;
  /**
   * `post` -> its `post_response`/`post_attempt_failed`, in ms. Unlike the two
   * gap fields, this INCLUDES the rate limiter's sleep, so it is the measure
   * that actually shows whether a pacing override is being applied. Null if
   * the log ends before the outcome.
   */
  postToOutcomeMs: number | null;
  /**
   * False when this POST is a RETRY of one that was just rejected. The gate
   * and the §1 telemetry are both about DECISIONS, not requests: 132 empty-
   * token POSTs are 66 decisions each sent twice, so the meaningful rate is
   * 66/66 = 100%, not 66/132 = 50%.
   */
  isFirstAttempt: boolean;
}

export interface ClassBand {
  n: number;
  minMs: number | null;
  medianMs: number | null;
  maxMs: number | null;
}

export interface ClassSummary {
  label: string;
  /** Every POST of this class, retries included. */
  n: number;
  /** POSTs that were a first attempt — i.e. decisions. */
  decisions: number;
  firstAttemptFailures: number;
  /** Gap band over the SUCCESSFUL members of this class, on the response clock. */
  acceptedBand: ClassBand;
  /** Gap band over the REJECTED members of this class, on the response clock. */
  rejectedBand: ClassBand;
  /** `post` -> outcome, including the rate limiter's sleep — the pacing-sensitive measure. */
  outcomeBand: ClassBand;
}

const EMPTY_TOKEN_RE = /'actionToken':\s*''/;

function tokenClassOf(body: unknown): { action: string; tokenClass: TokenClass } {
  if (typeof body === "string") {
    const action = /'action':\s*'([^']+)'/.exec(body)?.[1] ?? "?";
    return { action, tokenClass: EMPTY_TOKEN_RE.test(body) ? "empty" : "numeric" };
  }
  const b = body as { action?: string; actionToken?: unknown };
  return { action: b?.action ?? "?", tokenClass: b?.actionToken === "" ? "empty" : "numeric" };
}

function band(values: number[]): ClassBand {
  if (values.length === 0) return { n: 0, minMs: null, medianMs: null, maxMs: null };
  const v = [...values].sort((a, b) => a - b);
  return { n: v.length, minMs: v[0]!, medianMs: v[(v.length - 1) >> 1]!, maxMs: v[v.length - 1]! };
}

/** Parses one run log into per-POST attempt records. Tolerates malformed lines. */
export function auditRunLog(file: string, text: string): AttemptRecord[] {
  const events: Record<string, unknown>[] = [];
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    try {
      events.push(JSON.parse(t) as Record<string, unknown>);
    } catch {
      /* a truncated final line is not a reason to lose the whole log */
    }
  }

  const out: AttemptRecord[] = [];
  let lastResponseAt: number | null = null;
  let lastEventAt: number | null = null;
  let previousAttemptFailed = false;

  for (let i = 0; i < events.length; i++) {
    const e = events[i]!;
    const ev = e["event"] as string | undefined;
    const at = Date.parse(e["ts"] as string);
    if (Number.isNaN(at)) continue;

    if (ev === "post" || ev === "use_item_post") {
      const { action, tokenClass } = tokenClassOf(e["body"]);
      const next = events[i + 1]?.["event"];
      let outcomeAt: number | null = null;
      for (let j = i + 1; j < events.length; j++) {
        const ev2 = events[j]!["event"];
        if (ev2 === "post_response" || ev2 === "use_item_response" || ev2 === "post_attempt_failed") {
          const t = Date.parse(events[j]!["ts"] as string);
          if (!Number.isNaN(t)) outcomeAt = t - at;
          break;
        }
      }
      out.push({
        postToOutcomeMs: outcomeAt,
        file,
        action,
        tokenClass,
        sinceLastResponseMs: lastResponseAt === null ? null : at - lastResponseAt,
        sinceLastRequestMs: lastEventAt === null ? null : at - lastEventAt,
        failed: next === "post_attempt_failed",
        isFirstAttempt: !previousAttemptFailed,
      });
      previousAttemptFailed = false;
    } else if (ev === "post_response" || ev === "use_item_response") {
      lastResponseAt = at;
      lastEventAt = at;
    } else if (ev === "post_attempt_failed") {
      // Deliberately does NOT advance `lastResponseAt`: a rejected POST issues
      // no new token, so the outstanding one still dates from the last
      // successful response.
      lastEventAt = at;
      previousAttemptFailed = true;
    }
  }
  return out;
}

/**
 * `start_run` is split out from the other empty-token actions. It is the
 * control case for the whole timing model — it sends `actionToken: ""` too,
 * but no token is ever outstanding at that moment, and it has never been
 * rejected.
 */
export function classify(r: AttemptRecord): string {
  if (r.action === "start_run") return "start_run (empty)";
  return r.tokenClass === "empty" ? "empty token" : "numeric token";
}

export function summarize(records: AttemptRecord[]): ClassSummary[] {
  const byClass = new Map<string, AttemptRecord[]>();
  for (const r of records) {
    const k = classify(r);
    byClass.set(k, [...(byClass.get(k) ?? []), r]);
  }
  return [...byClass.entries()]
    .map(([label, rs]) => ({
      label,
      n: rs.length,
      decisions: rs.filter((r) => r.isFirstAttempt).length,
      firstAttemptFailures: rs.filter((r) => r.isFirstAttempt && r.failed).length,
      acceptedBand: band(rs.filter((r) => !r.failed && r.sinceLastResponseMs !== null).map((r) => r.sinceLastResponseMs!)),
      rejectedBand: band(rs.filter((r) => r.failed && r.sinceLastResponseMs !== null).map((r) => r.sinceLastResponseMs!)),
      outcomeBand: band(rs.filter((r) => r.postToOutcomeMs !== null).map((r) => r.postToOutcomeMs!)),
    }))
    .sort((a, b) => b.n - a.n);
}

function fmtBand(b: ClassBand): string {
  if (b.n === 0) return "—";
  return `${(b.minMs! / 1000).toFixed(2)} – ${(b.maxMs! / 1000).toFixed(2)} s (med ${(b.medianMs! / 1000).toFixed(2)}, n=${b.n})`;
}

/**
 * The ten run logs that existed BEFORE session 53's pacing fix landed.
 *
 * Named explicitly rather than derived from a date, because the properties
 * pinned against them — the 66/66 rejection split and the zero-overlap gap
 * bands — are facts about the pre-fix regime and are DELIBERATELY not true of
 * the corpus as a whole any more. A post-fix log has empty-token POSTs
 * accepted at ~1.2s of `sinceLastResponseMs`, because that gap is measured at
 * log-write time and the new 4000ms sleep happens after it. Asserting
 * zero-overlap over all logs would fail for the best possible reason, which
 * is not a useful test.
 */
export const PRE_SESSION_53_LOGS: readonly string[] = [
  "logs/run-2026-08-18-19-50-13.jsonl",
  "logs/run-2026-08-18-21-15-24.jsonl",
  "logs/run-2026-08-18-21-59-34.jsonl",
  "logs/run-2026-08-18-22-00-26.jsonl",
  "logs/run-2026-08-18-22-07-12.jsonl",
  "logs/run-2026-08-19-23-56-06.jsonl",
  "logs/run-2026-08-20-00-30-09.jsonl",
  "logs/run-2026-08-20-00-30-48.jsonl",
  "logs/run-2026-08-20-00-45-19.jsonl",
  "logs/run-2026-08-20-00-46-46.jsonl",
];

export function defaultLogFiles(dir = "logs"): string[] {
  return readdirSync(dir)
    .filter((f) => f.startsWith("run-") && f.endsWith(".jsonl"))
    .sort()
    .map((f) => join(dir, f));
}

function main(): void {
  const argv = process.argv.slice(2);
  const asJson = argv.includes("--json");
  const files = argv.filter((a) => !a.startsWith("--"));
  const targets = files.length > 0 ? files : defaultLogFiles();

  const all: AttemptRecord[] = [];
  for (const f of targets) all.push(...auditRunLog(f, readFileSync(f, "utf8")));

  if (asJson) {
    console.log(JSON.stringify({ files: targets, summary: summarize(all) }, null, 2));
    return;
  }

  console.log(`\n▸ rejection audit over ${targets.length} run log(s), ${all.length} POSTs\n`);
  console.log(
    `  ${"class".padEnd(20)}${"POSTs".padStart(6)}${"decisions".padStart(11)}${"1st-fail".padStart(12)}  ` +
      `${"rejected gap".padEnd(32)}${"accepted gap".padEnd(32)}post->outcome (incl. pacing)`,
  );
  for (const s of summarize(all)) {
    const rate = s.decisions === 0 ? 0 : (s.firstAttemptFailures / s.decisions) * 100;
    console.log(
      `  ${s.label.padEnd(20)}${String(s.n).padStart(6)}${String(s.decisions).padStart(11)}` +
        `${`${s.firstAttemptFailures} (${rate.toFixed(0)}%)`.padStart(12)}  ` +
        `${fmtBand(s.rejectedBand).padEnd(32)}${fmtBand(s.acceptedBand).padEnd(32)}${fmtBand(s.outcomeBand)}`,
    );
  }

  console.log(`\n  per file:`);
  for (const f of targets) {
    const rs = all.filter((r) => r.file === f);
    const fails = rs.filter((r) => r.isFirstAttempt && r.failed).length;
    console.log(`    ${f.padEnd(40)} ${String(rs.length).padStart(4)} POSTs, ${String(fails).padStart(3)} first-attempt failures`);
  }
  console.log();
}

const isMain = process.argv[1] && process.argv[1].endsWith("rejectionAudit.ts");
if (isMain) main();
