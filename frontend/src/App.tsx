import { useState, useRef, useCallback, useEffect } from "react";
import "./App.css";
import { Save, FolderOpen, ChevronsLeft, Menu } from "lucide-react";
import { authService, workspaceService } from "./services/container";
import { useSelectedWorkspace } from "./features/workspace/SelectedWorkspaceProvider";
import { confirm } from "./ui/ConfirmModal";
import TaskMgtApp, { type TaskMgtAppHandle } from "./features/tasks/TasksApp";
import { TeamMgt } from "./features/teams/TeamsApp";
import type { Person, Team } from "./domain/teams/types";
import type { TeamMgtHandle } from "./features/teams/types";
import type { ProjectData, ProjectState } from "./domain/workspace/types";
import { createDefaultProject, extractProjectState } from "./domain/workspace/projectState";
import { parseWorkspaceFile } from "./domain/workspace/parseWorkspaceFile";
import { ProjectAdminDialog } from "./features/workspace/ProjectAdminDialog";
import { useWorkspaceLoader } from "./hooks/useWorkspaceLoader";

type ActiveModule = "tasks" | "teams";

function App() {
  const { id: workspaceId, select } = useSelectedWorkspace();

  const {
    status: loadStatus,
    name: workspaceName,
    loadCount: workspaceLoadCount,
    hydration,
  } = useWorkspaceLoader({ workspaceId, subscribe: workspaceService.subscribe });

  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string>("");
  const [people, setPeople] = useState<Person[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeModule, setActiveModule] = useState<ActiveModule>("tasks");
  const [showProjectAdmin, setShowProjectAdmin] = useState(false);

  // Bumped when in-memory state is replaced from a non-workspace source
  // (currently: opening a legacy save file). Used in the child key so the
  // task/team views remount with fresh internal state.
  const [localReloadKey, setLocalReloadKey] = useState(0);

  const teamMgtRef = useRef<TeamMgtHandle>(null);
  const taskMgtRef = useRef<TaskMgtAppHandle>(null);
  const currentProjectStateRef = useRef<ProjectState | null>(null);
  const projectsRef = useRef(projects);
  projectsRef.current = projects;
  const activeProjectIdRef = useRef(activeProjectId);
  activeProjectIdRef.current = activeProjectId;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const menuWrapperRef = useRef<HTMLDivElement>(null);
  const [appMenuOpen, setAppMenuOpen] = useState(false);

  useEffect(() => {
    if (!appMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuWrapperRef.current && !menuWrapperRef.current.contains(e.target as Node)) {
        setAppMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [appMenuOpen]);

  // Apply the hook's hydration data to local editing state when a workspace loads.
  useEffect(() => {
    if (!hydration) return;
    currentProjectStateRef.current = extractProjectState(hydration.projects[0]);
    setProjects(hydration.projects);
    setActiveProjectId(hydration.activeProjectId);
    setPeople(hydration.people);
    setTeams(hydration.teams);
    setHasUnsavedChanges(false);
  }, [hydration]);

  // If the doc vanished (deleted elsewhere), drop to the picker.
  useEffect(() => {
    if (loadStatus === "missing") select(null);
  }, [loadStatus, select]);

  const activeProject = projects.find((p) => p.id === activeProjectId) ?? projects[0];

  const handleProjectStateChange = useCallback((state: ProjectState) => {
    currentProjectStateRef.current = state;
    setHasUnsavedChanges(true);
  }, []);

  const getProjectsForSave = useCallback((): ProjectData[] => {
    return projectsRef.current.map((p) =>
      p.id === activeProjectIdRef.current && currentProjectStateRef.current
        ? { ...p, ...currentProjectStateRef.current }
        : p,
    );
  }, []);

  const handleSave = useCallback(async () => {
    if (!workspaceId || saving) return;
    setSaving(true);
    try {
      await workspaceService.saveContent(workspaceId, {
        projects: getProjectsForSave(),
        people,
        teams,
      });
      setHasUnsavedChanges(false);
    } catch (err) {
      console.error("Save failed:", err);
    } finally {
      setSaving(false);
    }
  }, [workspaceId, saving, people, teams, getProjectsForSave]);

  const handleOpenLegacyFile = useCallback(async () => {
    if (hasUnsavedChanges) {
      const confirmed = await confirm({
        title: "Unsaved changes",
        message: "Opening a savefile will discard your unsaved local edits. Continue?",
        confirmLabel: "Open",
      });
      if (!confirmed) return;
    }
    fileInputRef.current?.click();
  }, [hasUnsavedChanges]);

  const handleLegacyFileSelected = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = parseWorkspaceFile(JSON.parse(text));
      const loaded = parsed.projects.length > 0 ? parsed.projects : [createDefaultProject()];
      currentProjectStateRef.current = extractProjectState(loaded[0]);
      setProjects(loaded);
      setActiveProjectId(loaded[0].id);
      setPeople(parsed.people);
      setTeams(parsed.teams);
      setHasUnsavedChanges(true);
      setLocalReloadKey((c) => c + 1);
    } catch (err) {
      console.error("Failed to open savefile:", err);
      window.alert("Could not open file: the selected file is not a valid Opus savefile.");
    }
  }, []);

  const handleBackToPicker = useCallback(async () => {
    if (hasUnsavedChanges) {
      const confirmed = await confirm({
        title: "Unsaved changes",
        message: "Leave this workspace without saving? Your local edits will be lost.",
        confirmLabel: "Leave",
      });
      if (!confirmed) return;
    }
    select(null);
  }, [hasUnsavedChanges, select]);

  const handleSignOut = useCallback(async () => {
    if (hasUnsavedChanges) {
      const confirmed = await confirm({
        title: "Unsaved changes",
        message: "Sign out without saving? Your local edits will be lost.",
        confirmLabel: "Sign out",
      });
      if (!confirmed) return;
    }
    await authService.signOut();
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

  // Project management (intra-workspace projects, unchanged semantics).
  const handleSwitchProject = useCallback((newId: string) => {
    if (newId === activeProjectIdRef.current) return;
    setProjects((prev) =>
      prev.map((p) =>
        p.id === activeProjectIdRef.current && currentProjectStateRef.current
          ? { ...p, ...currentProjectStateRef.current }
          : p,
      ),
    );
    const newProject = projectsRef.current.find((p) => p.id === newId);
    if (newProject) currentProjectStateRef.current = extractProjectState(newProject);
    setActiveProjectId(newId);
  }, []);

  const handleAddProject = useCallback(() => {
    const fresh = createDefaultProject("New Project");
    setProjects((prev) => [
      ...prev.map((p) =>
        p.id === activeProjectIdRef.current && currentProjectStateRef.current
          ? { ...p, ...currentProjectStateRef.current }
          : p,
      ),
      fresh,
    ]);
    currentProjectStateRef.current = extractProjectState(fresh);
    setActiveProjectId(fresh.id);
    setHasUnsavedChanges(true);
  }, []);

  const handleRenameProject = useCallback((id: string, name: string) => {
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)));
    setHasUnsavedChanges(true);
  }, []);

  const handleDeleteProject = useCallback(async (id: string) => {
    const current = projectsRef.current;
    if (current.length <= 1) return;
    const project = current.find((p) => p.id === id);
    const confirmed = await confirm({
      title: "Delete Project",
      message: `Delete "${project?.name || "this project"}"? This cannot be undone.`,
      confirmLabel: "Delete",
    });
    if (!confirmed) return;
    const remaining = current.filter((p) => p.id !== id);
    setProjects(remaining);
    if (activeProjectIdRef.current === id) {
      const next = remaining[0];
      currentProjectStateRef.current = extractProjectState(next);
      setActiveProjectId(next.id);
    }
    setHasUnsavedChanges(true);
  }, []);

  if (loadStatus !== "ready" || !activeProject) {
    return <div className="app-loading">Loading workspace…</div>;
  }

  const saveTitle = saving ? "Saving…" : hasUnsavedChanges ? "Save workspace" : "Saved";

  return (
    <div className="app-shell">
      <div className="top-app-bar">
        <div className="app-bar-left">
          <button
            className="app-bar-icon-btn"
            onClick={handleBackToPicker}
            title="Switch workspace"
          >
            <ChevronsLeft size={16} />
          </button>
          <button
            className="app-bar-icon-btn"
            onClick={handleSave}
            title={saveTitle}
            disabled={saving}
          >
            <Save size={16} />
          </button>
          <button
            className="app-bar-icon-btn"
            onClick={handleOpenLegacyFile}
            title="Open legacy savefile"
          >
            <FolderOpen size={16} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            style={{ display: "none" }}
            onChange={handleLegacyFileSelected}
          />
          <span className="app-bar-filename">
            {hasUnsavedChanges && <span className="app-bar-unsaved">●</span>}
            {workspaceName}
          </span>
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
        <div className="app-bar-right">
          <div className="app-bar-menu-wrapper" ref={menuWrapperRef}>
            <button
              type="button"
              className="app-bar-icon-btn"
              onClick={() => setAppMenuOpen((open) => !open)}
              title="Menu"
              aria-label="Menu"
              aria-expanded={appMenuOpen}
            >
              <Menu size={16} />
            </button>
            {appMenuOpen && (
              <div className="app-bar-menu-dropdown" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  className="app-bar-menu-item"
                  onClick={() => {
                    setAppMenuOpen(false);
                    taskMgtRef.current?.exportAsPng();
                  }}
                >
                  Export as PNG
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="app-bar-menu-item"
                  onClick={() => {
                    setAppMenuOpen(false);
                    taskMgtRef.current?.openHelp();
                  }}
                >
                  How to Use
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="app-bar-menu-item"
                  onClick={() => {
                    setAppMenuOpen(false);
                    taskMgtRef.current?.openSettings();
                  }}
                >
                  Settings
                </button>
                <hr className="app-bar-menu-divider" />
                <button
                  type="button"
                  role="menuitem"
                  className="app-bar-menu-item"
                  onClick={() => {
                    setAppMenuOpen(false);
                    handleSignOut();
                  }}
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
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
            ref={taskMgtRef}
            key={`${workspaceLoadCount}-${localReloadKey}-${activeProjectId}`}
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
            key={`${workspaceLoadCount}-${localReloadKey}`}
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
