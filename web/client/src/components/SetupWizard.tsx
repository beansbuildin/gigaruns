import { useEffect, useState } from "react";

import { api } from "../api";
import type { JwtStatus } from "../types";

function formatSecondsLeft(s: number): string {
  const hours = s / 3600;
  if (hours < 1) return `${Math.round(s / 60)}m`;
  if (hours < 48) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

export function SetupWizard({ profile }: { profile: string }) {
  const [status, setStatus] = useState<JwtStatus | null>(null);
  const [token, setToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => {
    api
      .getJwtStatus(profile)
      .then(setStatus)
      .catch((e) => setError((e as Error).message));
  };

  useEffect(() => {
    setError(null);
    setStatus(null);
    setToken("");
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  const save = async () => {
    setError(null);
    setSaving(true);
    try {
      await api.saveJwt(profile, token);
      setToken("");
      refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="panel">
      <h2>Setup — profile "{profile}"</h2>

      <ol className="setup-steps">
        <li>
          Log in at <a href="https://gigaverse.io" target="_blank" rel="noreferrer">gigaverse.io</a> in your browser, with the account you want this profile to control.
        </li>
        <li>Open DevTools → Network, then play one action in the game so a request fires.</li>
        <li>
          Click any request to <code>gigaverse.io/api</code> and find the request header <code>Authorization: Bearer &lt;token&gt;</code>.
        </li>
        <li>Copy only the token part — not the word "Bearer", not the whole header line.</li>
        <li>Paste it below and save.</li>
      </ol>

      <p className="hint">
        This never leaves your machine. It's written straight to the same file the CLI already reads
        {status?.path ? <> (<code>{status.path}</code>)</> : null}, with no server anywhere else involved.
      </p>

      <div className="setup-form">
        <input
          type="password"
          placeholder="paste your token here"
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
        <button onClick={save} disabled={saving || !token.trim()}>
          {saving ? "Saving…" : "Save token"}
        </button>
      </div>

      {error && <p className="error-text">{error}</p>}

      {status && (
        <div className="jwt-status">
          {!status.present && <p>No token saved yet for this profile.</p>}
          {status.present && status.malformed && <p className="error-text">The saved token doesn't parse as a JWT — re-copy it.</p>}
          {status.present && !status.malformed && (
            <p className={status.expired ? "error-text" : "ok-text"}>
              Token present ({status.masked}).{" "}
              {status.expired
                ? "It has EXPIRED — repeat the steps above to get a fresh one."
                : status.secondsLeft != null
                  ? `Valid for another ${formatSecondsLeft(status.secondsLeft)}.`
                  : "Could not read an expiry claim, but it's saved."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
