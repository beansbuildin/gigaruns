/**
 * web/server/src/routes/jobs.ts — trigger the bot's existing CLI scripts as
 * child processes, and stream their output to the browser over SSE.
 *
 * The allowlist below (`JobKind`) is the whole safety boundary of this
 * route: the browser can never pass an arbitrary command or arbitrary
 * flags. It picks one of a fixed set of job kinds; this file alone decides
 * what script and what flags that maps to. A LIVE job (one that can
 * actually spend energy — `dungeon-run` / `fishing-run`) additionally
 * requires `confirmed: true` in the body, checked server-side, not just
 * gated by a confirmation dialog the client could skip.
 */

import { Router } from "express";

import { getJob, killJob, startJob, type Job, type JobLine } from "../jobManager.js";
import { resolveProfile } from "../parentRepo.js";

const router = Router();

type JobKind = "doctor" | "dungeon-status" | "dungeon-dry-run" | "dungeon-run" | "fishing-dry-run" | "fishing-run";

const JOB_KINDS: readonly JobKind[] = ["doctor", "dungeon-status", "dungeon-dry-run", "dungeon-run", "fishing-dry-run", "fishing-run"];

const LIVE_KINDS: readonly JobKind[] = ["dungeon-run", "fishing-run"];

interface JobBody {
  kind?: unknown;
  profile?: unknown;
  confirmed?: unknown;
  juicedIndex?: unknown;
  runs?: unknown;
  casts?: unknown;
}

function buildArgs(kind: JobKind, profileName: string, body: JobBody): { script: string; args: string[] } {
  const profileFlag = `--profile=${profileName}`;

  if (kind === "doctor") return { script: "scripts/doctor.ts", args: [profileFlag] };

  if (kind === "dungeon-status") return { script: "scripts/liveRun.ts", args: [profileFlag, "--status"] };

  if (kind === "dungeon-dry-run" || kind === "dungeon-run") {
    const juicedIndex = Number(body.juicedIndex ?? 2);
    const runs = Number(body.runs ?? 1);
    const args = [profileFlag];
    if (kind === "dungeon-dry-run") args.push("--dry-run");
    args.push("--juiced", `--juiced-index=${juicedIndex}`, `--runs=${runs}`);
    return { script: "scripts/liveRun.ts", args };
  }

  // fishing-dry-run | fishing-run
  const casts = Number(body.casts ?? 1);
  const args = [profileFlag];
  if (kind === "fishing-dry-run") args.push("--dry-run");
  args.push(`--casts=${casts}`);
  return { script: "scripts/liveFishing.ts", args };
}

router.post("/", (req, res) => {
  const body = (req.body ?? {}) as JobBody;
  const kind = String(body.kind ?? "") as JobKind;
  const profileName = String(body.profile ?? "default");

  if (!JOB_KINDS.includes(kind)) {
    res.status(400).json({ error: `Unknown job kind "${kind}". Expected one of: ${JOB_KINDS.join(", ")}.` });
    return;
  }

  try {
    resolveProfile(profileName);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
    return;
  }

  if (LIVE_KINDS.includes(kind) && body.confirmed !== true) {
    res.status(400).json({ error: "This job spends real budget — the request must include confirmed: true." });
    return;
  }

  const { script, args } = buildArgs(kind, profileName, body);
  const job = startJob("npx", ["tsx", script, ...args]);
  res.json({ jobId: job.id, kind, script, args });
});

router.get("/:id", (req, res) => {
  const job = getJob(req.params.id);
  if (!job) {
    res.status(404).json({ error: "No such job." });
    return;
  }
  res.json(serializeJob(job));
});

router.get("/:id/stream", (req, res) => {
  const job = getJob(req.params.id);
  if (!job) {
    res.status(404).end();
    return;
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  // Replay what already happened before this client connected — a job that
  // started a moment before the browser opened the stream must not lose its
  // first lines.
  for (const line of job.lines) res.write(sseLine({ type: "line", ...line }));
  if (job.finishedAt !== null) {
    res.write(sseLine({ type: "done", exitCode: job.exitCode }));
    res.end();
    return;
  }

  const onLine = (line: JobLine) => res.write(sseLine({ type: "line", ...line }));
  const onDone = (exitCode: number | null) => {
    res.write(sseLine({ type: "done", exitCode }));
    res.end();
  };
  job.listeners.add(onLine);
  job.doneListeners.add(onDone);

  req.on("close", () => {
    job.listeners.delete(onLine);
    job.doneListeners.delete(onDone);
  });
});

router.post("/:id/kill", (req, res) => {
  res.json({ ok: killJob(req.params.id) });
});

function sseLine(payload: unknown): string {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

function serializeJob(job: Job) {
  return {
    id: job.id,
    command: job.command,
    args: job.args,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    exitCode: job.exitCode,
    lines: job.lines,
  };
}

export default router;
