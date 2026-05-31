import { Play } from "lucide-react";
import "./PresentationBar.css";
import type { Person } from "../../../domain/teams/types";
import { PersonAvatar } from "../PersonAvatar";

interface PresentationBarProps {
  /** People assigned at least one task on the canvas. */
  people: Person[];
  selectedPersonId: string | null;
  /** Zero-based index of the task currently focused for the selected person. */
  currentIndex: number;
  /** Number of tasks the selected person is assigned (the carousel length). */
  taskCount: number;
  onSelectPerson: (personId: string) => void;
  onAdvance: () => void;
}

/**
 * A row beneath the canvas toolbar listing people with assigned tasks. Selecting
 * a person starts a presentation that steps the viewport through that person's
 * tasks in sequence order, one per click of the play button.
 */
export function PresentationBar({
  people,
  selectedPersonId,
  currentIndex,
  taskCount,
  onSelectPerson,
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
        disabled={!hasSelection}
        aria-label="Go to the selected person's next task"
        data-tooltip="Present tasks"
      >
        <Play size={16} />
      </button>
      {hasSelection && taskCount > 0 && (
        <span className="canvas-presentation-count">
          {currentIndex + 1}/{taskCount}
        </span>
      )}
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
