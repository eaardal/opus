import { useEffect, useRef, useState } from "react";
import "./StatusFilterSelect.css";
import type { TaskStatus } from "../../../domain/tasks/types";
import type { StatusConfig } from "../theme";

/** A presentation-mode status filter: a specific status, or "all" statuses. */
export type StatusFilter = TaskStatus | "all";

interface StatusFilterSelectProps {
  statuses: Record<TaskStatus, StatusConfig>;
  value: StatusFilter;
  onChange: (value: StatusFilter) => void;
}

/**
 * A compact dropdown for choosing which task status the presentation carousel
 * should include. Each status is shown by its emoji to stay small; an "All"
 * option includes every status.
 */
export function StatusFilterSelect({ statuses, value, onChange }: StatusFilterSelectProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const statusEntries = Object.entries(statuses) as [TaskStatus, StatusConfig][];

  const select = (next: StatusFilter) => {
    onChange(next);
    setOpen(false);
  };

  const face =
    value === "all" ? (
      <span className="status-filter-all">All</span>
    ) : (
      <span className="status-filter-emoji">{statuses[value].emoji}</span>
    );

  return (
    <div className="status-filter" ref={wrapperRef}>
      <button
        type="button"
        className="status-filter-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        title="Show tasks with this status"
      >
        {face}
        <span className="status-filter-chevron">▾</span>
      </button>
      {open && (
        <div className="status-filter-menu">
          <button
            type="button"
            className={`status-filter-option ${value === "all" ? "selected" : ""}`}
            onClick={() => select("all")}
            title="All statuses"
          >
            <span className="status-filter-all">All</span>
          </button>
          {statusEntries.map(([key, config]) => (
            <button
              key={key}
              type="button"
              className={`status-filter-option ${value === key ? "selected" : ""}`}
              onClick={() => select(key)}
              title={config.label}
            >
              <span className="status-filter-emoji">{config.emoji}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
