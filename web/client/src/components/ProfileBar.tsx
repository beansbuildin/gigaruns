import { useEffect, useState } from "react";

import { api } from "../api";

export function ProfileBar({ profile, onChange }: { profile: string; onChange: (name: string) => void }) {
  const [profiles, setProfiles] = useState<string[]>(["default"]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listProfiles()
      .then((r) => setProfiles(r.profiles))
      .catch((e) => setError((e as Error).message));
  }, []);

  const submitNew = async () => {
    setError(null);
    try {
      const { name } = await api.createProfile(newName.trim());
      setProfiles((prev) => (prev.includes(name) ? prev : [...prev, name]));
      onChange(name);
      setCreating(false);
      setNewName("");
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="profile-bar">
      <label>
        Profile
        <select value={profile} onChange={(e) => onChange(e.target.value)}>
          {profiles.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </label>
      {creating ? (
        <span className="profile-bar__new">
          <input
            autoFocus
            placeholder="new-profile-name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitNew()}
          />
          <button onClick={submitNew}>Add</button>
          <button onClick={() => setCreating(false)}>Cancel</button>
        </span>
      ) : (
        <button onClick={() => setCreating(true)}>+ new profile</button>
      )}
      {error && <span className="error-text">{error}</span>}
    </div>
  );
}
