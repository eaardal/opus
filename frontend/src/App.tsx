import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import "./App.css";
import { ChevronsLeft, Menu } from "lucide-react";
import { authService, workspaceService } from "./services/container";
import { useSelectedWorkspace } from "./features/workspace/SelectedWorkspaceProvider";
import { useAuthUser } from "./features/auth/useAuthUser";
import { confirm } from "./ui/ConfirmModal";
import { ChangelogModal } from "./ui/ChangelogModal";
import { CHANGELOG } from "./generated/changelog";
import TaskMgtApp, { type TaskMgtAppHandle } from "./features/tasks/TasksApp";
import { TeamMgt } from "./features/teams/TeamsApp";
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
    projects,
    people,
    teams,
    latestDoc,
  } = useWorkspaceLoader({ workspaceId, service: workspaceService });

  const role = useMemo(
    () => (currentUid ? resolveRole(latestDoc, currentUid) : null),
    [latestDoc, currentUid],
  );
  const canEdit = role === "owner" || role === "editor";

  const [activeProjectId, setActiveProjectId] = useState<string>("");
  const [activeModule, setActiveModule] = useState<ActiveModule>("tasks");
  const [showProjectAdmin, setShowProjectAdmin] = useState(false);
  const [appMenuOpen, setAppMenuOpen] = useState(false);
  const [showChangelog, setShowChangelog] = useState(false);
  const [lastSeenVersion, setLastSeenVersion] = useState<string | null>(
    readLastSeenChangelogVersion,
  );
  const hasNewChangelog = lastSeenVersion !== (CHANGELOG[0]?.version ?? "");

  const taskMgtRef = useRef<TaskMgtAppHandle>(null);
  const menuWrapperRef = useRef<HTMLDivElement>(null);

  // Set initial active project when workspace loads or switches.
  useEffect(() => {
    if (workspaceLoadCount > 0 && projects.length > 0) {
      setActiveProjectId((prev) => {
        if (prev && projects.some((p) => p.id === prev)) return prev;
        const storedId = workspaceId ? readLastActiveProjectId(workspaceId) : null;
        const restored = storedId ? projects.find((p) => p.id === storedId) : null;
        return restored ? restored.id : projects[0].id;
      });
    }
  }, [workspaceLoadCount, projects, workspaceId]);

  useEffect(() => {
    if (loadStatus === "missing") select(null);
  }, [loadStatus, select]);

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

  const handleBackToPicker = useCallback(() => {
    select(null);
  }, [select]);

  const handleSignOut = useCallback(async () => {
    await authService.signOut();
  }, []);

  const handleSwitchProject = useCallback(
    (newId: string) => {
      setActiveProjectId(newId);
      if (workspaceId) writeLastActiveProjectId(workspaceId, newId);
    },
    [workspaceId],
  );

  const handleAddProject = useCallback(async () => {
    if (!canEdit || !workspaceId) return;
    const project = {
      id: crypto.randomUUID(),
      name: "New Project",
      theme: "dark" as const,
      taskQueues: [],
      connections: [],
    };
    await workspaceService.addProject(workspaceId, project).catch(console.error);
    setActiveProjectId(project.id);
  }, [canEdit, workspaceId]);

  const handleRenameProject = useCallback(
    (id: string, name: string) => {
      if (!canEdit || !workspaceId) return;
      workspaceService.updateProjectMeta(workspaceId, id, { name }).catch(console.error);
    },
    [canEdit, workspaceId],
  );

  const handleDeleteProject = useCallback(
    async (id: string) => {
      if (!canEdit || !workspaceId) return;
      if (projects.length <= 1) return;
      const project = projects.find((p) => p.id === id);
      const confirmed = await confirm({
        title: "Delete Project",
        message: `Delete "${project?.name || "this project"}"? This cannot be undone.`,
        confirmLabel: "Delete",
      });
      if (!confirmed) return;
      await workspaceService.deleteProject(workspaceId, id).catch(console.error);
      if (activeProjectId === id) {
        const remaining = projects.filter((p) => p.id !== id);
        if (remaining.length > 0) setActiveProjectId(remaining[0].id);
      }
    },
    [canEdit, workspaceId, projects, activeProjectId],
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

  if (loadStatus !== "ready" || !activeProjectId) {
    return <div className="app-loading">Loading workspace…</div>;
  }

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
            <span className="app-bar-filename">
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
                      Changelog
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
                      void handleSignOut();
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
            onAdd={() => void handleAddProject()}
            onRename={handleRenameProject}
            onDelete={(id) => void handleDeleteProject(id)}
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
              key={`${workspaceLoadCount}-${activeProjectId}`}
              workspaceId={workspaceId ?? ""}
              projectId={activeProjectId}
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
              workspaceId={workspaceId ?? ""}
              initialPeople={people}
              initialTeams={teams}
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
