/**
 * web/server/src/jobManager.ts — runs a script as a child process and lets
 * any number of SSE clients watch its output live, including one that
 * connects a moment after the job already started.
 *
 * In-memory only, on purpose: this is a local, single-user tool (the whole
 * point of this web UI is that nothing here is hosted — see the repo
 * README's "Not planned" section), so there is exactly one person who could
 * ever be watching a job, and nothing needs to survive this process
 * restarting.
 */

import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { randomUUID } from "node:crypto";

import { REPO_ROOT } from "./repoRoot.js";

export interface JobLine {
  stream: "stdout" | "stderr";
  text: string;
  at: number;
}

export interface Job {
  id: string;
  command: string;
  args: string[];
  startedAt: number;
  finishedAt: number | null;
  exitCode: number | null;
  lines: JobLine[];
  listeners: Set<(line: JobLine) => void>;
  doneListeners: Set<(exitCode: number | null) => void>;
  child: ChildProcessWithoutNullStreams;
}

const jobs = new Map<string, Job>();

/** Bound how many finished jobs are kept around, so a long-running server doesn't leak memory one job at a time. */
const MAX_FINISHED_JOBS = 50;

export function startJob(command: string, args: string[]): Job {
  const child = spawn(command, args, { cwd: REPO_ROOT, env: process.env });
  const id = randomUUID();
  const job: Job = {
    id,
    command,
    args,
    startedAt: Date.now(),
    finishedAt: null,
    exitCode: null,
    lines: [],
    listeners: new Set(),
    doneListeners: new Set(),
    child,
  };

  const feed = (stream: "stdout" | "stderr") => (chunk: Buffer) => {
    const line: JobLine = { stream, text: chunk.toString("utf8"), at: Date.now() };
    job.lines.push(line);
    for (const listener of job.listeners) listener(line);
  };
  child.stdout.on("data", feed("stdout"));
  child.stderr.on("data", feed("stderr"));
  child.on("close", (code) => {
    job.finishedAt = Date.now();
    job.exitCode = code;
    for (const listener of job.doneListeners) listener(code);
  });
  child.on("error", (err) => {
    const line: JobLine = { stream: "stderr", text: `\n[failed to start: ${err.message}]\n`, at: Date.now() };
    job.lines.push(line);
    for (const listener of job.listeners) listener(line);
  });

  jobs.set(id, job);
  pruneFinishedJobs();
  return job;
}

function pruneFinishedJobs(): void {
  const finished = [...jobs.values()].filter((j) => j.finishedAt !== null);
  if (finished.length <= MAX_FINISHED_JOBS) return;
  finished.sort((a, b) => (a.finishedAt ?? 0) - (b.finishedAt ?? 0));
  for (const job of finished.slice(0, finished.length - MAX_FINISHED_JOBS)) {
    jobs.delete(job.id);
  }
}

export function getJob(id: string): Job | undefined {
  return jobs.get(id);
}

/** Returns false if the job is unknown or already finished — killing a finished job is a no-op, not an error. */
export function killJob(id: string): boolean {
  const job = jobs.get(id);
  if (!job || job.finishedAt !== null) return false;
  job.child.kill("SIGTERM");
  return true;
}
