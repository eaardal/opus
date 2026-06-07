import { useEffect, useState } from "react";
import "./LinkDestinationDialog.css";
import { taskDisplayTitle } from "../../../domain/tasks/displayTitle";
import type { Group, LinkTarget, Task } from "../../../domain/tasks/types";
import type { ProjectSummary } from "../../../services/workspace.types";

interface ProjectContentLite {
  tasks: Task[];
  groups: Group[];
}

interface LinkDestinationDialogProps {
  /** Excluded from the task list so a task can't link to itself. */
  sourceTaskId: string;
  projects: ProjectSummary[];
  activeProjectId: string;
  /** When editing an existing link, pre-selects this destination. */
  initialTarget?: LinkTarget;
  /** Loads a project's tasks/groups (in-memory for the active project, fetched otherwise). */
  loadProjectContent: (projectId: string) => Promise<ProjectContentLite | null>;
  onConfirm: (target: LinkTarget) => void;
  onCancel: () => void;
}

function targetsEqual(a: LinkTarget, b: LinkTarget): boolean {
  if (a.kind !== b.kind || a.projectId !== b.projectId) return false;
  if (a.kind === "task" && b.kind === "task") return a.taskId === b.taskId;
  if (a.kind === "group" && b.kind === "group") return a.groupId === b.groupId;
  return a.kind === "project";
}

export function LinkDestinationDialog({
  sourceTaskId,
  projects,
  activeProjectId,
  initialTarget,
  loadProjectContent,
  onConfirm,
  onCancel,
}: LinkDestinationDialogProps) {
  const [projectId, setProjectId] = useState(initialTarget?.projectId ?? activeProjectId);
  const [content, setContent] = useState<ProjectContentLite | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [target, setTarget] = useState<LinkTarget | null>(initialTarget ?? null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setContent(null);
    loadProjectContent(projectId)
      .then((c) => {
        if (!cancelled) {
          setContent(c);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setContent(null);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, loadProjectContent]);

  const changeProject = (id: string) => {
    setProjectId(id);
    setTarget(null);
    setFilter("");
  };

  const lower = filter.toLowerCase().trim();
  const tasks = (content?.tasks ?? [])
    .map((task, i) => ({ task, seq: i + 1 }))
    .filter(({ task }) => task.id !== sourceTaskId)
    .filter(
      ({ task, seq }) =>
        !lower || taskDisplayTitle(task.text).toLowerCase().includes(lower) || String(seq) === lower,
    );
  const groups = (content?.groups ?? []).filter(
    (g) => !lower || (g.title || "").toLowerCase().includes(lower),
  );
  const isActive = (t: LinkTarget) => target !== null && targetsEqual(target, t);

  return (
    <div className="link-dialog-overlay" onClick={onCancel}>
      <div
        className="link-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Choose link destination"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="link-dialog-title">Link to…</h2>

        <label className="link-dialog-field">
          <span className="link-dialog-label">Project</span>
          <select
            className="link-dialog-select"
            value={projectId}
            onChange={(e) => changeProject(e.target.value)}
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name || "(unnamed project)"}
              </option>
            ))}
          </select>
        </label>

        <input
          className="link-dialog-filter"
          placeholder="Filter tasks and groups…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />

        <div className="link-dialog-list">
          <button
            type="button"
            className={`link-dialog-item link-dialog-project ${isActive({ kind: "project", projectId }) ? "selected" : ""}`}
            onClick={() => setTarget({ kind: "project", projectId })}
          >
            📁 This project (open it directly)
          </button>

          {loading && <div className="link-dialog-empty">Loading…</div>}
          {!loading && !content && <div className="link-dialog-empty">Project not found.</div>}

          {!loading && content && (
            <>
              <div className="link-dialog-section">Tasks</div>
              {tasks.length === 0 && <div className="link-dialog-empty">No tasks</div>}
              {tasks.map(({ task, seq }) => {
                const t: LinkTarget = { kind: "task", projectId, taskId: task.id };
                return (
                  <button
                    type="button"
                    key={task.id}
                    className={`link-dialog-item ${isActive(t) ? "selected" : ""}`}
                    onClick={() => setTarget(t)}
                  >
                    <span className="link-dialog-seq">#{seq}</span>
                    <span className="link-dialog-item-text">{taskDisplayTitle(task.text)}</span>
                  </button>
                );
              })}

              <div className="link-dialog-section">Groups</div>
              {groups.length === 0 && <div className="link-dialog-empty">No groups</div>}
              {groups.map((group) => {
                const t: LinkTarget = { kind: "group", projectId, groupId: group.id };
                return (
                  <button
                    type="button"
                    key={group.id}
                    className={`link-dialog-item ${isActive(t) ? "selected" : ""}`}
                    onClick={() => setTarget(t)}
                  >
                    <span className="link-dialog-item-text">{group.title || "(unnamed group)"}</span>
                  </button>
                );
              })}
            </>
          )}
        </div>

        <div className="link-dialog-actions">
          <button type="button" className="link-dialog-btn" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="link-dialog-btn link-dialog-btn-primary"
            disabled={target === null}
            onClick={() => target && onConfirm(target)}
          >
            Set destination
          </button>
        </div>
      </div>
    </div>
  );
}
