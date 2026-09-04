import { useState } from "react";

import { ConfigEditor } from "./components/ConfigEditor";
import { ProfileBar } from "./components/ProfileBar";
import { RunControls } from "./components/RunControls";
import { SetupWizard } from "./components/SetupWizard";
import { StatusPanel } from "./components/StatusPanel";

type Tab = "setup" | "status" | "config" | "run";

const TABS: { id: Tab; label: string }[] = [
  { id: "setup", label: "Setup" },
  { id: "status", label: "Status" },
  { id: "config", label: "Budgets" },
  { id: "run", label: "Run" },
];

export function App() {
  const [profile, setProfile] = useState("default");
  const [tab, setTab] = useState<Tab>("setup");

  return (
    <div className="app">
      <header className="app__header">
        <h1>Giga bot — local control panel</h1>
        <p className="app__subtitle">
          Running on your machine only. Nothing here is hosted — see the repo README's "Not planned" section.
        </p>
      </header>

      <ProfileBar profile={profile} onChange={setProfile} />

      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={t.id === tab ? "tab tab--active" : "tab"} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>

      <main>
        {tab === "setup" && <SetupWizard profile={profile} />}
        {tab === "status" && <StatusPanel profile={profile} />}
        {tab === "config" && <ConfigEditor profile={profile} />}
        {tab === "run" && <RunControls profile={profile} />}
      </main>
    </div>
  );
}
