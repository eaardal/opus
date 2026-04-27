import { useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { workspaceService } from "../../services/container";
import { confirm } from "../../ui/ConfirmModal";
import { useAuthUser } from "../auth/useAuthUser";
import {
  canDeleteWorkspace,
  canEdit as canEditFn,
  canManageMembers,
  resolveRole,
} from "../../domain/workspace/roles";
import type { WorkspaceDocument, WorkspaceSummary } from "../../services/workspace.types";
import { MembersSection } from "./MembersSection";
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
  const auth = useAuthUser();
  const currentUid = auth.status === "signedIn" ? auth.user.uid : null;
  const [doc, setDoc] = useState<WorkspaceDocument | null>(null);
  const [name, setName] = useState(workspace.name);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return workspaceService.subscribe(workspace.id, setDoc);
  }, [workspace.id]);

  useEffect(() => {
    if (doc) setName(doc.name);
  }, [doc]);

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

  const role = currentUid ? resolveRole(doc, currentUid) : null;
  const canEdit = canEditFn(role);
  const canDelete = canDeleteWorkspace(role);
  const canManage = canManageMembers(role);

  const trimmed = name.trim();
  const baseName = doc?.name ?? workspace.name;
  const nameChanged = trimmed.length > 0 && trimmed !== baseName;
  const busy = saving || deleting;

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameChanged || busy || !canEdit) return;
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
    if (busy || !canDelete) return;
    const confirmed = await confirm({
      title: "Delete workspace",
      message: `Delete "${baseName}"? This permanently removes all projects, tasks, people and teams in it. This cannot be undone.`,
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
              disabled={busy || !canEdit}
            />
            <button
              type="submit"
              className="workspace-settings-primary-btn"
              disabled={!nameChanged || busy || !canEdit}
              title={canEdit ? undefined : "View-only access"}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>

        {doc && currentUid && (
          <MembersSection
            workspaceId={workspace.id}
            doc={doc}
            currentUid={currentUid}
            canManage={canManage}
          />
        )}

        {canDelete && (
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
        )}

        {error && <p className="workspace-settings-error">{error}</p>}
      </div>
    </div>
  );
}
