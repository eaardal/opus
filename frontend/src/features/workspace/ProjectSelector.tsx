import { useState, useRef, useEffect } from "react";
import { Settings } from "lucide-react";
import "./ProjectSelector.css";
import type { ProjectData } from "../../domain/workspace/types";

interface ProjectSelectorProps {
  projects: ProjectData[];
  activeProjectId: string;
  onSwitch: (id: string) => void;
  onOpenAdmin: () => void;
}

export function ProjectSelector({
  projects,
  activeProjectId,
  onSwitch,
  onOpenAdmin,
}: ProjectSelectorProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const activeProject = projects.find((p) => p.id === activeProjectId) ?? projects[0];

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className="project-selector-row">
      <span className="project-selector-label">Project</span>
      <div className="project-selector-wrapper" ref={wrapperRef}>
        <button className="project-selector-btn" onClick={() => setOpen((v) => !v)}>
          <span className="project-selector-name">{activeProject?.name ?? "—"}</span>
          <span className="project-selector-chevron">▾</span>
        </button>
        {open && (
          <div className="project-selector-dropdown">
            {projects.map((project) => (
              <button
                key={project.id}
                className={`project-selector-item ${project.id === activeProjectId ? "active" : ""}`}
                onClick={() => {
                  onSwitch(project.id);
                  setOpen(false);
                }}
              >
                {project.name}
              </button>
            ))}
          </div>
        )}
      </div>
      <button className="project-admin-btn" onClick={onOpenAdmin} title="Manage projects">
        <Settings size={14} />
      </button>
    </div>
  );
}
