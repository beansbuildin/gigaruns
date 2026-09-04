import { useEffect, useState } from "react";

import { api } from "../api";
import type { BotConfig } from "../types";

export function ConfigEditor({ profile }: { profile: string }) {
  const [config, setConfig] = useState<BotConfig | null>(null);
  const [exists, setExists] = useState(true);
  const [path, setPath] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    setSavedNote(null);
    api
      .getConfig(profile)
      .then((r) => {
        setExists(r.exists);
        setPath(r.path);
        setConfig(
          r.config ?? {
            forbiddenWoods: { dailyEnergyBudget: 240, maxRunsPerSession: 12 },
            dendren: { dailyEnergyBudget: 240, maxCastsPerSession: 20 },
          },
        );
      })
      .catch((e) => setError((e as Error).message));
  }, [profile]);

  const set = (path: [string, string], value: number) => {
    setConfig((prev) => {
      if (!prev) return prev;
      const [section, field] = path;
      return { ...prev, [section]: { ...(prev[section] as object), [field]: value } };
    });
  };

  const save = async () => {
    if (!config) return;
    setSaving(true);
    setError(null);
    setSavedNote(null);
    try {
      await api.saveConfig(profile, config);
      setExists(true);
      setSavedNote("Saved. Run the status check to confirm it's valid — this form doesn't validate values itself.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (!config) return <div className="panel">Loading…</div>;

  return (
    <div className="panel">
      <h2>Budgets — profile "{profile}"</h2>
      <p className="hint">
        {exists ? <>Editing <code>{path}</code>.</> : <>Nothing saved yet for this profile — these are starting defaults, not yet written to <code>{path}</code>.</>}{" "}
        These are ceilings this bot imposes on itself, layered on top of the game's own daily caps (which always win regardless of what's set here).
      </p>

      <fieldset>
        <legend>Forbidden Woods (dungeon)</legend>
        <label>
          Daily energy budget
          <input
            type="number"
            value={config.forbiddenWoods?.dailyEnergyBudget ?? 0}
            onChange={(e) => set(["forbiddenWoods", "dailyEnergyBudget"], Number(e.target.value))}
          />
        </label>
        <label>
          Max runs per session
          <input
            type="number"
            value={config.forbiddenWoods?.maxRunsPerSession ?? 0}
            onChange={(e) => set(["forbiddenWoods", "maxRunsPerSession"], Number(e.target.value))}
          />
        </label>
      </fieldset>

      <fieldset>
        <legend>Dendren (fishing)</legend>
        <label>
          Daily energy budget
          <input
            type="number"
            value={config.dendren?.dailyEnergyBudget ?? 0}
            onChange={(e) => set(["dendren", "dailyEnergyBudget"], Number(e.target.value))}
          />
        </label>
        <label>
          Max casts per session
          <input
            type="number"
            value={config.dendren?.maxCastsPerSession ?? 0}
            onChange={(e) => set(["dendren", "maxCastsPerSession"], Number(e.target.value))}
          />
        </label>
      </fieldset>

      <button onClick={save} disabled={saving}>
        {saving ? "Saving…" : "Save budgets"}
      </button>
      {error && <p className="error-text">{error}</p>}
      {savedNote && <p className="ok-text">{savedNote}</p>}
    </div>
  );
}
