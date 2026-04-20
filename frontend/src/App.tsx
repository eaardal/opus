import { useState, useRef } from "react";
import "./App.css";
import TaskMgtApp from "./taskMgt/App";
import { TeamMgt } from "./teamMgt/TeamMgt";
import { TeamMgtHandle } from "./teamMgt/types";

type ActiveModule = "tasks" | "teams";

function App() {
  const [activeModule, setActiveModule] = useState<ActiveModule>("tasks");
  const teamMgtRef = useRef<TeamMgtHandle>(null);

  return (
    <div className="app-shell">
      <div className="top-app-bar">
        <nav className="app-bar-nav">
          <button
            className={`app-bar-tab ${activeModule === "tasks" ? "active" : ""}`}
            onClick={() => setActiveModule("tasks")}
          >
            Tasks
          </button>
          <button
            className={`app-bar-tab ${activeModule === "teams" ? "active" : ""}`}
            onClick={() => setActiveModule("teams")}
          >
            Teams
          </button>
        </nav>
      </div>
      <div className="app-shell-content">
        <div className={`module-wrapper ${activeModule === "tasks" ? "" : "module-hidden"}`}>
          <TaskMgtApp />
        </div>
        <div className={`module-wrapper ${activeModule === "teams" ? "" : "module-hidden"}`}>
          <TeamMgt ref={teamMgtRef} />
        </div>
      </div>
    </div>
  );
}

export default App;
