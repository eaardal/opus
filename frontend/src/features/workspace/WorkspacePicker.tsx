import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { Settings } from "lucide-react";
import { authService, workspaceService } from "../../services/container";
import type { WorkspaceSummary } from "../../services/workspace.types";
import { useSelectedWorkspace } from "./SelectedWorkspaceProvider";
import { WorkspaceSettingsDialog } from "./WorkspaceSettingsDialog";
import "./WorkspacePicker.css";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; workspaces: WorkspaceSummary[] };

export function WorkspacePicker() {
  const { select } = useSelectedWorkspace();
  const [state, setState] = useState<State>({ status: "loading" });
  const [settingsFor, setSettingsFor] = useState<WorkspaceSummary | null>(null);

  // Reset theme to light when entering the picker. A workspace may have set
  // dark mode on the document; the picker shouldn't inherit it.
  useLayoutEffect(() => {
    document.documentElement.setAttribute("data-theme", "light");
  }, []);

  const reload = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const workspaces = await workspaceService.listMine();
      setState({ status: "ready", workspaces });
    } catch (err) {
      console.error("Failed to list workspaces:", err);
      setState({
        status: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const handleRenamed = useCallback((id: string, name: string) => {
    setState((prev) =>
      prev.status === "ready"
        ? { ...prev, workspaces: prev.workspaces.map((w) => (w.id === id ? { ...w, name } : w)) }
        : prev,
    );
    setSettingsFor((prev) => (prev && prev.id === id ? { ...prev, name } : prev));
  }, []);

  const handleDeleted = useCallback((id: string) => {
    setState((prev) =>
      prev.status === "ready"
        ? { ...prev, workspaces: prev.workspaces.filter((w) => w.id !== id) }
        : prev,
    );
    setSettingsFor(null);
  }, []);

  return (
    <div className="workspace-picker">
      <div className="workspace-picker-card">
        <header className="workspace-picker-header">
          <h1 className="workspace-picker-title">Domino</h1>
          <button
            type="button"
            className="workspace-picker-link"
            onClick={() => authService.signOut()}
          >
            Sign out
          </button>
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
              />
            )}
            <CreateWorkspaceRow
              onCreated={(id) => {
                select(id);
              }}
            />
          </>
        )}
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
}: {
  title: string;
  workspaces: WorkspaceSummary[];
  emptyMessage: string;
  onOpen: (id: string) => void;
  onOpenSettings: (workspace: WorkspaceSummary) => void;
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
