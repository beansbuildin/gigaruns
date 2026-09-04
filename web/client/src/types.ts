export interface JwtStatus {
  present: boolean;
  path: string;
  malformed?: boolean;
  masked?: string;
  exp?: number | null;
  secondsLeft?: number | null;
  expired?: boolean;
}

export interface ConfigResponse {
  exists: boolean;
  path: string;
  config?: BotConfig;
}

/** Only the fields the editor exposes — `config/bot.json` may carry more; unknown fields are preserved on save, not dropped. */
export interface BotConfig {
  forbiddenWoods?: {
    dailyEnergyBudget?: number;
    maxRunsPerSession?: number;
  };
  dendren?: {
    dailyEnergyBudget?: number;
    maxCastsPerSession?: number;
  };
  [key: string]: unknown;
}

export type JobKind = "doctor" | "dungeon-status" | "dungeon-dry-run" | "dungeon-run" | "fishing-dry-run" | "fishing-run";

export interface JobLine {
  stream: "stdout" | "stderr";
  text: string;
  at: number;
}

export interface JobStartResponse {
  jobId: string;
  kind: JobKind;
  script: string;
  args: string[];
}

export interface JobDetail {
  id: string;
  command: string;
  args: string[];
  startedAt: number;
  finishedAt: number | null;
  exitCode: number | null;
  lines: JobLine[];
}

export type SseEvent = ({ type: "line" } & JobLine) | { type: "done"; exitCode: number | null };
