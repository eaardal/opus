import { useState } from "react";
import "./App.css";
import TaskMgtApp from "./taskMgt/App";
import { TeamMgt } from "./teamMgt/TeamMgt";

type ActiveModule = "tasks" | "teams";

function App() {
  const [activeModule, setActiveModule] = useState<ActiveModule>("tasks");

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
        {activeModule === "tasks" && <TaskMgtApp />}
        {activeModule === "teams" && <TeamMgt />}
      </div>
    </div>
  );
}

export default App;
