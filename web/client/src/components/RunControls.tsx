import { useState } from "react";

import { api } from "../api";
import type { JobKind } from "../types";
import { LogStream } from "./LogStream";

interface Pending {
  kind: Extract<JobKind, "dungeon-run" | "fishing-run">;
  label: string;
  params: Record<string, number>;
}

/**
 * Dry-run buttons fire immediately — they send no action, per `--dry-run`'s
 * own contract in the CLI. LIVE buttons (the ones that can actually spend a
 * real account's energy) always go through a confirmation step first, and
 * the server independently refuses a live job without `confirmed: true` —
 * this dialog is a courtesy, not the only thing standing in the way.
 */
export function RunControls({ profile }: { profile: string }) {
  const [juicedIndex, setJuicedIndex] = useState(2);
  const [casts, setCasts] = useState(1);
  const [jobId, setJobId] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [error, setError] = useState<string | null>(null);

  const start = async (kind: JobKind, params: Record<string, number> = {}, confirmed = false) => {
    setError(null);
    try {
      const { jobId } = await api.startJob({ kind, profile, confirmed, ...params });
      setJobId(jobId);
      setPending(null);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="panel">
      <h2>Run — profile "{profile}"</h2>

      <fieldset>
        <legend>Dungeon (Forbidden Woods)</legend>
        <label>
          Juiced index
          <input type="number" min={0} value={juicedIndex} onChange={(e) => setJuicedIndex(Number(e.target.value))} />
        </label>
        <div className="run-buttons">
          <button onClick={() => start("dungeon-dry-run", { juicedIndex, runs: 1 })}>Dry-run one run</button>
          <button
            className="danger"
            onClick={() => setPending({ kind: "dungeon-run", label: `one juiced-${juicedIndex} dungeon run`, params: { juicedIndex, runs: 1 } })}
          >
            Play one run (live)
          </button>
        </div>
      </fieldset>

      <fieldset>
        <legend>Fishing (Dendren)</legend>
        <label>
          Casts
          <input type="number" min={1} value={casts} onChange={(e) => setCasts(Number(e.target.value))} />
        </label>
        <div className="run-buttons">
          <button onClick={() => start("fishing-dry-run", { casts })}>Dry-run {casts} cast(s)</button>
          <button className="danger" onClick={() => setPending({ kind: "fishing-run", label: `${casts} live fishing cast(s)`, params: { casts } })}>
            Fish (live)
          </button>
        </div>
      </fieldset>

      {pending && (
        <div className="confirm-box">
          <p>
            This will play <strong>{pending.label}</strong> on the real account, spending real energy. It plays one
            batch and stops — it will not chain into another automatically.
          </p>
          <button className="danger" onClick={() => start(pending.kind, pending.params, true)}>
            Yes, run it live
          </button>
          <button onClick={() => setPending(null)}>Cancel</button>
        </div>
      )}

      {error && <p className="error-text">{error}</p>}
      {jobId && <LogStream jobId={jobId} />}
    </div>
  );
}
