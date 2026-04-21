import { useState, useRef, useCallback, useEffect } from "react";
import "./App.css";
import { FilePlus, FolderOpen, Save } from "lucide-react";
import { ConfirmDialog, OpenFile, SaveFile, SaveFileAs } from "../wailsjs/go/main/App";
import TaskMgtApp from "./taskMgt/App";
import { TeamMgt } from "./teamMgt/TeamMgt";
import { TeamMgtHandle } from "./teamMgt/types";
import {
  ProjectData,
  WorkspaceFile,
  ProjectState,
  createDefaultProject,
  extractProjectState,
  parseWorkspaceFile,
} from "./workspace/types";
import { ProjectAdminDialog } from "./workspace/ProjectAdminDialog";

type ActiveModule = "tasks" | "teams";

function App() {
  const initialProject = createDefaultProject();

  const [projects, setProjects] = useState<ProjectData[]>([initialProject]);
  const [activeProjectId, setActiveProjectId] = useState<string>(initialProject.id);
  const [people, setPeople] = useState<ReturnType<TeamMgtHandle["getPeople"]>>([]);
  const [teams, setTeams] = useState<ReturnType<TeamMgtHandle["getTeams"]>>([]);
  const [currentFilePath, setCurrentFilePath] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [activeModule, setActiveModule] = useState<ActiveModule>("tasks");
  const [showProjectAdmin, setShowProjectAdmin] = useState(false);
  const [workspaceLoadCount, setWorkspaceLoadCount] = useState(0);

  const teamMgtRef = useRef<TeamMgtHandle>(null);
  const currentProjectStateRef = useRef<ProjectState>(extractProjectState(initialProject));
  const projectsRef = useRef(projects);
  projectsRef.current = projects;
  const activeProjectIdRef = useRef(activeProjectId);
  activeProjectIdRef.current = activeProjectId;

  const activeProject = projects.find(p => p.id === activeProjectId) ?? projects[0];
  const fileName = currentFilePath ? currentFilePath.split(/[\\/]/).pop() : null;

  const handleProjectStateChange = useCallback((state: ProjectState) => {
    currentProjectStateRef.current = state;
    setHasUnsavedChanges(true);
  }, []);

  const getProjectsForSave = useCallback((): ProjectData[] => {
    return projectsRef.current.map(p =>
      p.id === activeProjectIdRef.current
        ? { ...p, ...currentProjectStateRef.current }
        : p,
    );
  }, []);

  const handleSave = useCallback(async () => {
    const workspace: WorkspaceFile = {
      version: 2,
      projects: getProjectsForSave(),
      people,
      teams,
    };
    const data = JSON.stringify(workspace, null, 2);
    try {
      if (currentFilePath) {
        await SaveFile(currentFilePath, data);
        setHasUnsavedChanges(false);
      } else {
        const filePath = await SaveFileAs(data);
        if (filePath) {
          setCurrentFilePath(filePath);
          setHasUnsavedChanges(false);
        }
      }
    } catch (err) {
      console.error("Save failed:", err);
    }
  }, [people, teams, currentFilePath, getProjectsForSave]);

  const handleOpen = useCallback(async () => {
    try {
      const result = await OpenFile();
      if (!result) return;
      const workspace = parseWorkspaceFile(JSON.parse(result.content));
      const first = workspace.projects[0];
      currentProjectStateRef.current = extractProjectState(first);
      setProjects(workspace.projects);
      setActiveProjectId(first.id);
      setPeople(workspace.people ?? []);
      setTeams(workspace.teams ?? []);
      setCurrentFilePath(result.filePath);
      setHasUnsavedChanges(false);
      setWorkspaceLoadCount(c => c + 1);
    } catch (err) {
      console.error("Open failed:", err);
    }
  }, []);

  const handleNew = useCallback(async () => {
    if (hasUnsavedChanges) {
      const confirmed = await ConfirmDialog("New Workspace", "Discard unsaved changes and start fresh?");
      if (!confirmed) return;
    }
    const fresh = createDefaultProject();
    currentProjectStateRef.current = extractProjectState(fresh);
    setProjects([fresh]);
    setActiveProjectId(fresh.id);
    setPeople([]);
    setTeams([]);
    setCurrentFilePath(null);
    setHasUnsavedChanges(false);
    setWorkspaceLoadCount(c => c + 1);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleSave]);

  // Project management
  const handleSwitchProject = useCallback((newId: string) => {
    if (newId === activeProjectIdRef.current) return;
    setProjects(prev => prev.map(p =>
      p.id === activeProjectIdRef.current ? { ...p, ...currentProjectStateRef.current } : p,
    ));
    const newProject = projectsRef.current.find(p => p.id === newId);
    if (newProject) currentProjectStateRef.current = extractProjectState(newProject);
    setActiveProjectId(newId);
  }, []);

  const handleAddProject = useCallback(() => {
    const fresh = createDefaultProject("New Project");
    setProjects(prev => [
      ...prev.map(p =>
        p.id === activeProjectIdRef.current ? { ...p, ...currentProjectStateRef.current } : p,
      ),
      fresh,
    ]);
    currentProjectStateRef.current = extractProjectState(fresh);
    setActiveProjectId(fresh.id);
    setHasUnsavedChanges(true);
  }, []);

  const handleRenameProject = useCallback((id: string, name: string) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, name } : p));
    setHasUnsavedChanges(true);
  }, []);

  const handleDeleteProject = useCallback(async (id: string) => {
    const current = projectsRef.current;
    if (current.length <= 1) return;
    const project = current.find(p => p.id === id);
    const confirmed = await ConfirmDialog(
      "Delete Project",
      `Delete "${project?.name || "this project"}"? This cannot be undone.`,
    );
    if (!confirmed) return;
    const remaining = current.filter(p => p.id !== id);
    setProjects(remaining);
    if (activeProjectIdRef.current === id) {
      const next = remaining[0];
      currentProjectStateRef.current = extractProjectState(next);
      setActiveProjectId(next.id);
    }
    setHasUnsavedChanges(true);
  }, []);

  return (
    <div className="app-shell">
      <div className="top-app-bar">
        <div className="app-bar-left">
          <button className="app-bar-icon-btn" onClick={handleNew} title="New workspace">
            <FilePlus size={16} />
          </button>
          <button className="app-bar-icon-btn" onClick={handleOpen} title="Open workspace">
            <FolderOpen size={16} />
          </button>
          <button className="app-bar-icon-btn" onClick={handleSave} title="Save workspace">
            <Save size={16} />
          </button>
          {fileName && (
            <span className="app-bar-filename">
              {hasUnsavedChanges && <span className="app-bar-unsaved">●</span>}
              {fileName}
            </span>
          )}
        </div>
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
        <div className="app-bar-right" />
      </div>

      {showProjectAdmin && (
        <ProjectAdminDialog
          projects={projects}
          activeProjectId={activeProjectId}
          onAdd={handleAddProject}
          onRename={handleRenameProject}
          onDelete={handleDeleteProject}
          onClose={() => setShowProjectAdmin(false)}
        />
      )}

      <div className="app-shell-content">
        <div className={`module-wrapper ${activeModule === "tasks" ? "" : "module-hidden"}`}>
          <TaskMgtApp
            key={`${workspaceLoadCount}-${activeProjectId}`}
            initialProject={activeProject}
            onStateChange={handleProjectStateChange}
            projects={projects}
            activeProjectId={activeProjectId}
            onSwitchProject={handleSwitchProject}
            onOpenProjectAdmin={() => setShowProjectAdmin(true)}
            people={people}
          />
        </div>
        <div className={`module-wrapper ${activeModule === "teams" ? "" : "module-hidden"}`}>
          <TeamMgt
            key={workspaceLoadCount}
            ref={teamMgtRef}
            initialPeople={people}
            initialTeams={teams}
            onPeopleChange={setPeople}
            onTeamsChange={setTeams}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
