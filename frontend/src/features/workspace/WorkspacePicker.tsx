import { useCallback, useEffect, useState } from "react";
import { Settings } from "lucide-react";
import { authService, userService, workspaceService } from "../../services/container";
import type { WorkspaceSummary } from "../../services/workspace.types";
import type { RegisteredUser } from "../../services/user.types";
import { useSelectedWorkspace } from "./SelectedWorkspaceProvider";
import { WorkspaceSettingsDialog } from "./WorkspaceSettingsDialog";
import { useAuthUser } from "../auth/useAuthUser";
import { Avatar } from "../../ui/Avatar";
import "./WorkspacePicker.css";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; workspaces: WorkspaceSummary[] };

export function WorkspacePicker() {
  const { select } = useSelectedWorkspace();
  const auth = useAuthUser();
  const [state, setState] = useState<State>({ status: "loading" });
  const [settingsFor, setSettingsFor] = useState<WorkspaceSummary | null>(null);
  const [userDirectory, setUserDirectory] = useState<Map<string, RegisteredUser>>(new Map());

  useEffect(() => {
    setState({ status: "loading" });
    return workspaceService.subscribeMine((workspaces) => {
      setState({ status: "ready", workspaces });
    });
  }, []);

  useEffect(() => {
    userService.listAll().then((users) => {
      setUserDirectory(new Map(users.map((u) => [u.uid, u])));
    }).catch(console.error);
  }, []);

  const handleRenamed = useCallback((id: string, name: string) => {
    setSettingsFor((prev) => (prev && prev.id === id ? { ...prev, name } : prev));
  }, []);

  const handleDeleted = useCallback((_id: string) => {
    setSettingsFor(null);
  }, []);

  return (
    <div className="workspace-picker">
      <div className="workspace-picker-card">
        <header className="workspace-picker-header">
          <h1 className="workspace-picker-title">Domino</h1>
        </header>
        {state.status === "loading" && <p className="workspace-picker-status">Loading…</p>}
        {state.status === "error" && <p className="workspace-picker-error">{state.message}</p>}
        {state.status === "ready" && (
          <>
            <WorkspaceSection
              title="Your workspaces"
              workspaces={state.workspaces.filter((w) => w.role === "owner")}
              emptyMessage="No workspaces yet. Create one below."
              onOpen={select}
              onOpenSettings={setSettingsFor}
            />
            {state.workspaces.some((w) => w.role !== "owner") && (
              <WorkspaceSection
                title="Shared with you"
                workspaces={state.workspaces.filter((w) => w.role !== "owner")}
                emptyMessage=""
                onOpen={select}
                onOpenSettings={setSettingsFor}
                userDirectory={userDirectory}
              />
            )}
            <CreateWorkspaceRow
              onCreated={(id) => {
                select(id);
              }}
            />
          </>
        )}
        <footer className="workspace-picker-footer">
          {auth.status === "signedIn" && (
            <div className="workspace-picker-identity">
              <Avatar
                photoURL={auth.user.photoURL}
                fallbackText={auth.user.displayName ?? auth.user.email ?? "?"}
                className="workspace-picker-avatar"
                fallbackClassName="workspace-picker-avatar-fallback"
              />
              <div className="workspace-picker-identity-text">
                <span className="workspace-picker-identity-name">
                  {auth.user.displayName ?? auth.user.email ?? "Signed in"}
                </span>
                {auth.user.email && (
                  <span className="workspace-picker-identity-email">{auth.user.email}</span>
                )}
              </div>
            </div>
          )}
          <button
            type="button"
            className="workspace-picker-link"
            onClick={() => authService.signOut()}
          >
            Sign out
          </button>
        </footer>
      </div>

      {settingsFor && (
        <WorkspaceSettingsDialog
          workspace={settingsFor}
          onClose={() => setSettingsFor(null)}
          onRenamed={handleRenamed}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  );
}

function WorkspaceSection({
  title,
  workspaces,
  emptyMessage,
  onOpen,
  onOpenSettings,
  userDirectory,
}: {
  title: string;
  workspaces: WorkspaceSummary[];
  emptyMessage: string;
  onOpen: (id: string) => void;
  onOpenSettings: (workspace: WorkspaceSummary) => void;
  userDirectory?: Map<string, RegisteredUser>;
}) {
  return (
    <div className="workspace-picker-section">
      <h2 className="workspace-picker-subtitle">{title}</h2>
      {workspaces.length === 0 ? (
        emptyMessage ? (
          <p className="workspace-picker-empty">{emptyMessage}</p>
        ) : null
      ) : (
        <ul className="workspace-picker-list">
          {workspaces.map((w) => (
            <li key={w.id} className="workspace-picker-row">
              <button type="button" className="workspace-picker-item" onClick={() => onOpen(w.id)}>
                <span className="workspace-picker-item-name">{w.name}</span>
                {w.role !== "owner" && w.ownerEmail && (
                  <span className="workspace-picker-item-owner">
                    {ownerLine(w.ownerEmail, userDirectory)}
                  </span>
                )}
                <span className="workspace-picker-item-meta">
                  {w.role !== "owner" && (
                    <span className="workspace-picker-role-badge">{roleLabel(w.role)}</span>
                  )}
                  Updated {formatRelative(w.updatedAt)}
                </span>
              </button>
              <button
                type="button"
                className="workspace-picker-settings-btn"
                onClick={() => onOpenSettings(w)}
                title="Workspace settings"
                aria-label={`Settings for ${w.name}`}
              >
                <Settings size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ownerLine(ownerEmail: string, directory?: Map<string, RegisteredUser>): string {
  const user = directory?.get(ownerEmail);
  if (user?.displayName) return `by ${user.displayName} · ${ownerEmail}`;
  return `by ${ownerEmail}`;
}

function roleLabel(role: WorkspaceSummary["role"]): string {
  switch (role) {
    case "owner":
      return "Owner";
    case "editor":
      return "Editor";
    case "viewer":
      return "Viewer";
  }
}

function CreateWorkspaceRow({ onCreated }: { onCreated: (id: string) => void }) {
  const [mode, setMode] = useState<"idle" | "editing" | "creating">("idle");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setMode("creating");
    setError(null);
    try {
      const id = await workspaceService.create(trimmed);
      onCreated(id);
    } catch (err) {
      console.error("Create workspace failed:", err);
      setError(err instanceof Error ? err.message : String(err));
      setMode("editing");
    }
  };

  if (mode === "idle") {
    return (
      <button type="button" className="workspace-picker-create" onClick={() => setMode("editing")}>
        + New workspace
      </button>
    );
  }

  return (
    <form className="workspace-picker-create-form" onSubmit={handleSubmit}>
      <input
        type="text"
        className="workspace-picker-create-input"
        placeholder="Workspace name"
        value={name}
        autoFocus
        disabled={mode === "creating"}
        onChange={(e) => setName(e.target.value)}
      />
      <button
        type="submit"
        className="workspace-picker-create-submit"
        disabled={mode === "creating" || !name.trim()}
      >
        {mode === "creating" ? "Creating…" : "Create"}
      </button>
      <button
        type="button"
        className="workspace-picker-link"
        onClick={() => {
          setMode("idle");
          setName("");
          setError(null);
        }}
      >
        Cancel
      </button>
      {error && <p className="workspace-picker-error">{error}</p>}
    </form>
  );
}

function formatRelative(date: Date): string {
  const secondsAgo = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (secondsAgo < 60) return "just now";
  const minutes = Math.floor(secondsAgo / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return date.toLocaleDateString();
}
