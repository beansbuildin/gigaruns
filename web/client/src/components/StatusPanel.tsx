import { useState } from "react";

import { api } from "../api";
import { LogStream } from "./LogStream";

/** Runs `scripts/doctor.ts` — read-only, at most one authenticated GET, nothing spent. See that script's own doc comment. */
export function StatusPanel({ profile }: { profile: string }) {
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const runDoctor = async () => {
    setError(null);
    setRunning(true);
    setJobId(null);
    try {
      const { jobId } = await api.startJob({ kind: "doctor", profile });
      setJobId(jobId);
    } catch (e) {
      setError((e as Error).message);
      setRunning(false);
    }
  };

  return (
    <div className="panel">
      <h2>Status — profile "{profile}"</h2>
      <p className="hint">
        Runs <code>scripts/doctor.ts</code> exactly as the CLI would — Node version, token validity, config, and one
        read-only authenticated request to confirm which account this is. Nothing is spent.
      </p>
      <button onClick={runDoctor} disabled={running && jobId === null}>
        Run doctor check
      </button>
      {error && <p className="error-text">{error}</p>}
      {jobId && <LogStream jobId={jobId} onDone={() => setRunning(false)} />}
    </div>
  );
}
