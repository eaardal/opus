import { Play } from "lucide-react";
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
  /** Number of tasks in the carousel (the selected person, in the chosen status). */
  taskCount: number;
  onSelectPerson: (personId: string) => void;
  onSelectStatus: (filter: StatusFilter) => void;
  onAdvance: () => void;
}

/**
 * A row beneath the canvas toolbar listing people with assigned tasks. Selecting
 * a person starts a presentation that steps the viewport through that person's
 * tasks in sequence order, one per click of the play button. A status filter
 * narrows the carousel to tasks in a chosen status.
 */
export function PresentationBar({
  people,
  statuses,
  selectedPersonId,
  statusFilter,
  currentIndex,
  taskCount,
  onSelectPerson,
  onSelectStatus,
  onAdvance,
}: PresentationBarProps) {
  if (people.length === 0) return null;

  const hasSelection = selectedPersonId !== null;

  return (
    <div className="canvas-presentation-bar">
      <button
        type="button"
        className="canvas-toolbar-btn"
        onClick={onAdvance}
        disabled={!hasSelection || taskCount === 0}
        aria-label="Go to the selected person's next task"
        data-tooltip="Present tasks"
      >
        <Play size={16} />
      </button>
      {hasSelection && (
        <span className="canvas-presentation-count">
          {taskCount === 0 ? 0 : currentIndex + 1}/{taskCount}
        </span>
      )}
      <StatusFilterSelect statuses={statuses} value={statusFilter} onChange={onSelectStatus} />
      <div className="canvas-presentation-people">
        {people.map((person) => (
          <button
            key={person.id}
            type="button"
            className={`canvas-presentation-person ${
              person.id === selectedPersonId ? "selected" : ""
            }`}
            onClick={() => onSelectPerson(person.id)}
            aria-pressed={person.id === selectedPersonId}
            title={person.name || "(unnamed)"}
          >
            <PersonAvatar person={person} size={28} />
          </button>
        ))}
      </div>
    </div>
  );
}
