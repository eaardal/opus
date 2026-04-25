import { useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { workspaceService } from "../../services/container";
import { confirm } from "../../ui/ConfirmModal";
import type { WorkspaceSummary } from "../../services/workspace.types";
import "./WorkspaceSettingsDialog.css";

interface WorkspaceSettingsDialogProps {
  workspace: WorkspaceSummary;
  onClose: () => void;
  onRenamed: (id: string, name: string) => void;
  onDeleted: (id: string) => void;
}

export function WorkspaceSettingsDialog({
  workspace,
  onClose,
  onRenamed,
  onDeleted,
}: WorkspaceSettingsDialogProps) {
  const [name, setName] = useState(workspace.name);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameInputRef.current?.focus();
    nameInputRef.current?.select();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const trimmed = name.trim();
  const nameChanged = trimmed.length > 0 && trimmed !== workspace.name;
  const busy = saving || deleting;

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameChanged || busy) return;
    setSaving(true);
    setError(null);
    try {
      await workspaceService.rename(workspace.id, trimmed);
      onRenamed(workspace.id, trimmed);
    } catch (err) {
      console.error("Rename workspace failed:", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (busy) return;
    const confirmed = await confirm({
      title: "Delete workspace",
      message: `Delete "${workspace.name}"? This permanently removes all projects, tasks, people and teams in it. This cannot be undone.`,
      confirmLabel: "Delete",
    });
    if (!confirmed) return;
    setDeleting(true);
    setError(null);
    try {
      await workspaceService.remove(workspace.id);
      onDeleted(workspace.id);
    } catch (err) {
      console.error("Delete workspace failed:", err);
      setError(err instanceof Error ? err.message : String(err));
      setDeleting(false);
    }
  };

  return (
    <div className="workspace-settings-overlay" onClick={onClose}>
      <div
        className="workspace-settings-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="workspace-settings-title"
      >
        <div className="workspace-settings-header">
          <h3 id="workspace-settings-title">Workspace settings</h3>
          <button
            type="button"
            className="workspace-settings-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <form className="workspace-settings-section" onSubmit={handleSaveName}>
          <label className="workspace-settings-label" htmlFor="workspace-settings-name">
            Name
          </label>
          <div className="workspace-settings-row">
            <input
              ref={nameInputRef}
              id="workspace-settings-name"
              type="text"
              className="workspace-settings-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={busy}
            />
            <button
              type="submit"
              className="workspace-settings-primary-btn"
              disabled={!nameChanged || busy}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>

        <div className="workspace-settings-section workspace-settings-danger">
          <h4 className="workspace-settings-danger-title">Danger zone</h4>
          <div className="workspace-settings-row workspace-settings-danger-row">
            <span className="workspace-settings-danger-text">
              Delete this workspace and everything in it.
            </span>
            <button
              type="button"
              className="workspace-settings-danger-btn"
              onClick={handleDelete}
              disabled={busy}
            >
              <Trash2 size={14} />
              {deleting ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>

        {error && <p className="workspace-settings-error">{error}</p>}
      </div>
    </div>
  );
}
