import { useState, useRef, useEffect, useLayoutEffect } from "react";
import "./TaskContextMenu.css";
import type { Task, TaskStatus } from "../../domain/tasks/types";
import type { CategoryConfig, StatusConfig } from "./theme";
import type { Person } from "../../domain/teams/types";
import { avatarColor as personAvatarColor } from "../../lib/avatar";

function PersonAvatar({ person, size }: { person: Person; size: number }) {
  const initials = person.name.trim() ? person.name.trim()[0].toUpperCase() : "?";
  const style: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: "50%",
    flexShrink: 0,
    objectFit: "cover" as const,
  };
  return person.picture ? (
    <img style={style} src={person.picture} alt={person.name} />
  ) : (
    <span
      style={{
        ...style,
        background: personAvatarColor(person.id),
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.45,
        fontWeight: 600,
        color: "#fff",
      }}
    >
      {initials}
    </span>
  );
}

interface TaskContextMenuProps {
  task: Task;
  x: number;
  y: number;
  categories: Record<string, CategoryConfig>;
  statuses: Record<TaskStatus, StatusConfig>;
  people: Person[];
  onSetStatus: (status: TaskStatus) => void;
  onSetCategory: (category: string | undefined) => void;
  onDelete: () => void;
  onAssignPeople: (personIds: string[]) => void;
  onClose: () => void;
}

export function TaskContextMenu({
  task,
  x,
  y,
  categories,
  statuses,
  people,
  onSetStatus,
  onSetCategory,
  onDelete,
  onAssignPeople,
  onClose,
}: TaskContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [adjustedTop, setAdjustedTop] = useState(y);
  const [peopleFilter, setPeopleFilter] = useState("");
  const assignedIds = new Set(task.assignedPersonIds ?? []);

  useEffect(() => {
    const handleClose = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleClose);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClose);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  useLayoutEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const overflow = rect.bottom - (window.innerHeight - 8);
    if (overflow > 0) setAdjustedTop(Math.max(8, y - overflow));
    else setAdjustedTop(y);
  }, [y]);

  const togglePerson = (personId: string) => {
    const next = new Set(assignedIds);
    if (next.has(personId)) next.delete(personId);
    else next.add(personId);
    onAssignPeople([...next]);
  };

  const filteredPeople = people.filter(
    (p) => !peopleFilter || p.name.toLowerCase().includes(peopleFilter.toLowerCase()),
  );

  return (
    <div
      ref={menuRef}
      className="task-menu"
      style={{
        position: "fixed",
        top: adjustedTop,
        left: x,
        transform: "none",
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="menu-section-label">Status</div>
      {(Object.entries(statuses) as [TaskStatus, StatusConfig][]).map(([key, { label, color }]) => (
        <button
          key={key}
          className={`menu-item ${task.status === key ? "active" : ""}`}
          onClick={() => {
            onSetStatus(key);
            onClose();
          }}
        >
          <span className="status-dot" style={{ background: color }} />
          {label}
        </button>
      ))}

      <hr className="menu-divider" />
      <div className="menu-section-label">Category</div>
      {Object.entries(categories).map(([key, { label, color }]) => (
        <button
          key={key}
          className={`menu-item ${task.category === key ? "active" : ""}`}
          onClick={() => {
            onSetCategory(key);
            onClose();
          }}
        >
          <span className="category-dot" style={{ background: color }} />
          {label}
        </button>
      ))}

      {people.length > 0 && (
        <>
          <hr className="menu-divider" />
          <div className="menu-section-label">Assign people</div>
          <div className="tcm-people-filter-row">
            <input
              className="tcm-people-filter"
              placeholder="Filter..."
              value={peopleFilter}
              onChange={(e) => setPeopleFilter(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              autoFocus={false}
            />
          </div>
          <div className="tcm-people-list">
            {filteredPeople.map((person) => (
              <button
                key={person.id}
                className={`menu-item tcm-person-item ${assignedIds.has(person.id) ? "active" : ""}`}
                onClick={() => togglePerson(person.id)}
              >
                <PersonAvatar person={person} size={20} />
                <span className="tcm-person-name">{person.name || "(unnamed)"}</span>
                {assignedIds.has(person.id) && <span className="tcm-check">✓</span>}
              </button>
            ))}
            {filteredPeople.length === 0 && <div className="tcm-people-empty">No matches</div>}
          </div>
        </>
      )}

      <hr className="menu-divider" />
      {task.category && (
        <button
          className="menu-item clear-category"
          onClick={() => {
            onSetCategory(undefined);
            onClose();
          }}
        >
          Clear category
        </button>
      )}
      <button
        className="menu-item delete-item"
        onClick={() => {
          onDelete();
          onClose();
        }}
      >
        Delete
      </button>
    </div>
  );
}
