import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import "./App.css";
import { Save, FolderOpen, ChevronsLeft, Menu } from "lucide-react";
import { authService, workspaceService } from "./services/container";
import { useSelectedWorkspace } from "./features/workspace/SelectedWorkspaceProvider";
import { useAuthUser } from "./features/auth/useAuthUser";
import { confirm } from "./ui/ConfirmModal";
import { ChangelogModal } from "./ui/ChangelogModal";
import { CHANGELOG } from "./generated/changelog";
import TaskMgtApp, { type TaskMgtAppHandle } from "./features/tasks/TasksApp";
import { TeamMgt } from "./features/teams/TeamsApp";
import type { Person, Team } from "./domain/teams/types";
import type { TeamMgtHandle } from "./features/teams/types";
import type { ProjectData, ProjectState } from "./domain/workspace/types";
import { createDefaultProject, extractProjectState } from "./domain/workspace/projectState";
import { parseWorkspaceFile } from "./domain/workspace/parseWorkspaceFile";
import { ProjectAdminDialog } from "./features/workspace/ProjectAdminDialog";
import { useWorkspaceLoader } from "./hooks/useWorkspaceLoader";
import { resolveRole } from "./domain/workspace/roles";
import { WorkspaceRoleProvider } from "./features/workspace/WorkspaceRoleContext";
import { Avatar } from "./ui/Avatar";

type ActiveModule = "tasks" | "teams";

const lastProjectKey = (workspaceId: string) => `domino.lastActiveProjectId.${workspaceId}`;
const LAST_SEEN_CHANGELOG_KEY = "domino.lastSeenChangelogVersion";

function readLastSeenChangelogVersion(): string | null {
  try {
    return localStorage.getItem(LAST_SEEN_CHANGELOG_KEY);
  } catch {
    return null;
  }
}

function writeLastSeenChangelogVersion(version: string): void {
  try {
    localStorage.setItem(LAST_SEEN_CHANGELOG_KEY, version);
  } catch {
    // ignore — badge state still works in-memory
  }
}

function readLastActiveProjectId(workspaceId: string): string | null {
  try {
    return localStorage.getItem(lastProjectKey(workspaceId));
  } catch {
    return null;
  }
}

function writeLastActiveProjectId(workspaceId: string, projectId: string): void {
  try {
    localStorage.setItem(lastProjectKey(workspaceId), projectId);
  } catch {
    // ignore — selection still works in-memory
  }
}

function App() {
  const { id: workspaceId, select } = useSelectedWorkspace();
  const auth = useAuthUser();
  const currentUid = auth.status === "signedIn" ? auth.user.uid : null;

  const {
    status: loadStatus,
    loadError,
    name: workspaceName,
    loadCount: workspaceLoadCount,
    hydration,
    latestDoc,
  } = useWorkspaceLoader({ workspaceId, subscribe: workspaceService.subscribe });

  const role = useMemo(
    () => (currentUid ? resolveRole(latestDoc, currentUid) : null),
    [latestDoc, currentUid],
  );
  const canEdit = role === "owner" || role === "editor";

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
  const [showChangelog, setShowChangelog] = useState(false);
  const [lastSeenVersion, setLastSeenVersion] = useState<string | null>(
    readLastSeenChangelogVersion,
  );
  const hasNewChangelog = lastSeenVersion !== (CHANGELOG[0]?.version ?? "");

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
    const storedId = workspaceId ? readLastActiveProjectId(workspaceId) : null;
    const restored = storedId ? hydration.projects.find((p) => p.id === storedId) : null;
    const initial = restored ?? hydration.projects[0];
    currentProjectStateRef.current = extractProjectState(initial);
    setProjects(hydration.projects);
    setActiveProjectId(initial.id);
    setPeople(hydration.people);
    setTeams(hydration.teams);
    setHasUnsavedChanges(false);
  }, [hydration, workspaceId]);

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
    if (!workspaceId || saving || !canEdit) return;
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
  }, [workspaceId, saving, canEdit, people, teams, getProjectsForSave]);

  const handleOpenLegacyFile = useCallback(async () => {
    if (!canEdit) return;
    if (hasUnsavedChanges) {
      const confirmed = await confirm({
        title: "Unsaved changes",
        message: "Opening a savefile will discard your unsaved local edits. Continue?",
        confirmLabel: "Open",
      });
      if (!confirmed) return;
    }
    fileInputRef.current?.click();
  }, [canEdit, hasUnsavedChanges]);

  const handleLegacyFileSelected = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      if (!canEdit) return;
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
    },
    [canEdit],
  );

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
  const handleSwitchProject = useCallback(
    (newId: string) => {
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
      if (workspaceId) writeLastActiveProjectId(workspaceId, newId);
      setActiveProjectId(newId);
    },
    [workspaceId],
  );

  const handleAddProject = useCallback(() => {
    if (!canEdit) return;
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
  }, [canEdit]);

  const handleRenameProject = useCallback(
    (id: string, name: string) => {
      if (!canEdit) return;
      setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)));
      setHasUnsavedChanges(true);
    },
    [canEdit],
  );

  const handleDeleteProject = useCallback(
    async (id: string) => {
      if (!canEdit) return;
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
    },
    [canEdit],
  );

  if (loadStatus === "error") {
    const isPermissionDenied = loadError === "permission-denied";
    return (
      <div className="app-loading">
        <div className="app-load-error">
          <p className="app-load-error-title">
            {isPermissionDenied ? "Access denied" : "Failed to load workspace"}
          </p>
          <p className="app-load-error-body">
            {isPermissionDenied
              ? "You don't have permission to access this workspace. Your session may have expired or your access was revoked."
              : "An unexpected error occurred while loading this workspace."}
          </p>
          <div className="app-load-error-actions">
            <button type="button" className="app-load-error-btn" onClick={() => select(null)}>
              Back to workspaces
            </button>
            <button
              type="button"
              className="app-load-error-btn app-load-error-btn-primary"
              onClick={() => authService.signOut()}
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loadStatus !== "ready" || !activeProject) {
    return <div className="app-loading">Loading workspace…</div>;
  }

  const saveTitle = !canEdit
    ? "View-only — sign-in lacks edit permission"
    : saving
      ? "Saving…"
      : hasUnsavedChanges
        ? "Save workspace"
        : "Saved";

  return (
    <WorkspaceRoleProvider role={role}>
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
              disabled={saving || !canEdit}
            >
              <Save size={16} />
            </button>
            <button
              className="app-bar-icon-btn"
              onClick={handleOpenLegacyFile}
              title={canEdit ? "Open legacy savefile" : "View-only"}
              disabled={!canEdit}
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
              {role && <span className="app-bar-role-badge">{roleLabel(role)}</span>}
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
            {auth.status === "signedIn" && (
              <div className="app-bar-identity" title={auth.user.email ?? undefined}>
                <Avatar
                  photoURL={auth.user.photoURL}
                  fallbackText={auth.user.displayName ?? auth.user.email ?? "?"}
                  className="app-bar-avatar"
                  fallbackClassName="app-bar-avatar-fallback"
                />
                <div className="app-bar-identity-text">
                  <span className="app-bar-identity-name">
                    {auth.user.displayName ?? auth.user.email ?? "Signed in"}
                  </span>
                  {auth.user.email && (
                    <span className="app-bar-identity-email">{auth.user.email}</span>
                  )}
                </div>
              </div>
            )}
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
                      setShowChangelog(true);
                    }}
                  >
                    <span className="app-bar-menu-item-row">
                      What's New
                      {hasNewChangelog && <span className="app-bar-menu-new-dot" />}
                    </span>
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

        {showChangelog && (
          <ChangelogModal
            lastSeenVersion={lastSeenVersion}
            onClose={() => {
              const latest = CHANGELOG[0]?.version ?? "";
              writeLastSeenChangelogVersion(latest);
              setLastSeenVersion(latest);
              setShowChangelog(false);
            }}
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
              workspaceId={workspaceId ?? ""}
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
    </WorkspaceRoleProvider>
  );
}

function roleLabel(role: NonNullable<ReturnType<typeof resolveRole>>): string {
  switch (role) {
    case "owner":
      return "Owner";
    case "editor":
      return "Editor";
    case "viewer":
      return "Viewer";
  }
}

export default App;
