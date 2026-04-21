import { useState, useRef, useEffect } from "react";
import { Plus, Trash2 } from "lucide-react";
import "./ProjectAdminDialog.css";
import { ProjectData } from "./types";

interface ProjectAdminDialogProps {
  projects: ProjectData[];
  activeProjectId: string;
  onAdd: () => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export function ProjectAdminDialog({ projects, activeProjectId, onAdd, onRename, onDelete, onClose }: ProjectAdminDialogProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const startEdit = (project: ProjectData) => {
    setEditingId(project.id);
    setEditValue(project.name);
  };

  const commitEdit = (id: string) => {
    if (editValue.trim()) onRename(id, editValue.trim());
    setEditingId(null);
  };

  return (
    <div className="project-admin-overlay" onClick={onClose}>
      <div className="project-admin-dialog" onClick={e => e.stopPropagation()}>
        <div className="project-admin-header">
          <h3>Projects</h3>
          <button className="project-admin-close" onClick={onClose}>×</button>
        </div>
        <div className="project-admin-list">
          {projects.map(project => (
            <div key={project.id} className={`project-admin-item ${project.id === activeProjectId ? "active" : ""}`}>
              {editingId === project.id ? (
                <input
                  ref={editInputRef}
                  className="project-admin-edit-input"
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  onBlur={() => commitEdit(project.id)}
                  onKeyDown={e => {
                    if (e.key === "Enter") commitEdit(project.id);
                    if (e.key === "Escape") setEditingId(null);
                  }}
                />
              ) : (
                <span
                  className="project-admin-name"
                  onDoubleClick={() => startEdit(project)}
                  title="Double-click to rename"
                >
                  {project.name}
                </span>
              )}
              <button
                className="project-admin-delete"
                onClick={() => onDelete(project.id)}
                disabled={projects.length <= 1}
                title={projects.length <= 1 ? "Cannot delete the last project" : "Delete project"}
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
        <div className="project-admin-footer">
          <button className="project-admin-add-btn" onClick={onAdd}>
            <Plus size={14} />
            New project
          </button>
        </div>
      </div>
    </div>
  );
}
