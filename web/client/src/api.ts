import type { BotConfig, ConfigResponse, JobKind, JobStartResponse, JwtStatus } from "./types";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const body = (await res.json().catch(() => null)) as unknown;
  if (!res.ok) {
    const message = body && typeof body === "object" && "error" in body ? String((body as { error: unknown }).error) : `HTTP ${res.status}`;
    throw new Error(message);
  }
  return body as T;
}

export const api = {
  listProfiles: () => request<{ profiles: string[] }>("/api/profiles"),
  createProfile: (name: string) => request<{ name: string }>("/api/profiles", { method: "POST", body: JSON.stringify({ name }) }),

  getJwtStatus: (profile: string) => request<JwtStatus>(`/api/profiles/${encodeURIComponent(profile)}/jwt`),
  saveJwt: (profile: string, token: string) =>
    request<{ ok: true; path: string }>(`/api/profiles/${encodeURIComponent(profile)}/jwt`, {
      method: "POST",
      body: JSON.stringify({ token }),
    }),

  getConfig: (profile: string) => request<ConfigResponse>(`/api/profiles/${encodeURIComponent(profile)}/config`),
  saveConfig: (profile: string, config: BotConfig) =>
    request<{ ok: true; path: string }>(`/api/profiles/${encodeURIComponent(profile)}/config`, {
      method: "PUT",
      body: JSON.stringify({ config }),
    }),

  startJob: (params: { kind: JobKind; profile: string; confirmed?: boolean; juicedIndex?: number; runs?: number; casts?: number }) =>
    request<JobStartResponse>("/api/jobs", { method: "POST", body: JSON.stringify(params) }),
  killJob: (jobId: string) => request<{ ok: boolean }>(`/api/jobs/${encodeURIComponent(jobId)}/kill`, { method: "POST" }),
};
