import { ChevronsLeft, ChevronsRight, Play } from "lucide-react";
import { useState } from "react";
import "./PresentationBar.css";
import type { TaskStatus } from "../../../domain/tasks/types";
import type { Person } from "../../../domain/teams/types";
import type { StatusConfig } from "../theme";
import { PersonAvatar } from "../PersonAvatar";
import { StatusFilterSelect, type StatusFilter } from "./StatusFilterSelect";

interface PresentationBarProps {
  /** People assigned at least one task on the canvas. */
  people: Person[];
  statuses: Record<TaskStatus, StatusConfig>;
  selectedPersonId: string | null;
  /** Which status the carousel is filtered to (or "all"). */
  statusFilter: StatusFilter;
  /** Zero-based index of the task currently focused for the selected person. */
  currentIndex: number;
  /** Each person's task count in the current status filter, keyed by person id. */
  taskCountsByPerson: Record<string, number>;
  onSelectPerson: (personId: string) => void;
  onSelectStatus: (filter: StatusFilter) => void;
  onAdvance: () => void;
}

/**
 * A row beneath the canvas action bar listing people with assigned tasks. Each
 * person has a Play button under their avatar: the first click starts a
 * presentation that focuses the viewport on that person's first task, and each
 * further click steps to their next task (wrapping). A status filter narrows the
 * carousel, and a toggle on the right collapses the bar toward the screen edge.
 */
export function PresentationBar({
  people,
  statuses,
  selectedPersonId,
  statusFilter,
  currentIndex,
  taskCountsByPerson,
  onSelectPerson,
  onSelectStatus,
  onAdvance,
}: PresentationBarProps) {
  const [collapsed, setCollapsed] = useState(false);

  if (people.length === 0) return null;

  return (
    <div className={`canvas-presentation-bar ${collapsed ? "collapsed" : ""}`}>
      {!collapsed && (
        <>
          <div className="canvas-presentation-status">
            <span className="canvas-presentation-section-label">Status</span>
            <StatusFilterSelect
              statuses={statuses}
              value={statusFilter}
              onChange={onSelectStatus}
            />
          </div>
          <div className="canvas-presentation-people">
            {people.map((person) => {
              const isActive = person.id === selectedPersonId;
              const name = person.name || "(unnamed)";
              const total = taskCountsByPerson[person.id] ?? 0;
              // Always show the person's total; while presenting, prefix the
              // position within it (e.g. "2/3" vs "3").
              const count = isActive && total > 0 ? `${currentIndex + 1}/${total}` : `${total}`;
              return (
                <div
                  key={person.id}
                  className={`canvas-presentation-person ${isActive ? "active" : ""}`}
                  title={name}
                >
                  <span className="canvas-presentation-avatar">
                    <PersonAvatar person={person} size={28} />
                  </span>
                  <button
                    type="button"
                    className="canvas-presentation-play"
                    onClick={() => (isActive ? onAdvance() : onSelectPerson(person.id))}
                    disabled={total === 0}
                    aria-label={
                      isActive ? `Advance ${name}'s presentation` : `Present ${name}'s tasks`
                    }
                  >
                    <Play size={14} />
                  </button>
                  <span className="canvas-presentation-count">{count}</span>
                </div>
              );
            })}
          </div>
        </>
      )}
      <button
        type="button"
        className="canvas-presentation-toggle"
        onClick={() => setCollapsed((c) => !c)}
        aria-label={collapsed ? "Expand presentation bar" : "Collapse presentation bar"}
        aria-expanded={!collapsed}
        title={collapsed ? "Expand" : "Collapse"}
      >
        {collapsed ? <ChevronsLeft size={16} /> : <ChevronsRight size={16} />}
      </button>
    </div>
  );
}
