import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./TimelinePanel.css";
import { Maximize, Minus, Plus, X } from "lucide-react";
import type { Task, TaskStatus } from "../../../domain/tasks/types";
import type { Person } from "../../../domain/teams/types";
import type { StatusConfig } from "../theme";
import {
  personInProgressMs,
  tasksWithInProgressHistory,
  totalInProgressMs,
} from "../../../domain/tasks/timeline";
import {
  chooseTickStep,
  generateTicks,
  panTimeRange,
  type TimeRange,
  timeToFraction,
  zoomTimeRange,
} from "../../../lib/timelineScale";
import { wheelZoomFactor } from "../../../domain/tasks/viewport";
import { formatDurationShort } from "../../../lib/time";
import { avatarColor } from "../../../lib/avatar";
import { useNow } from "../../../hooks/useNow";
import { PersonAvatar } from "../PersonAvatar";

const LABEL_WIDTH = 240;
const DEFAULT_HEIGHT = 360;
const EXPANDED_HEIGHT_RATIO = 0.8;
const MAX_TICKS = 8;
const MIN_SPAN_MS = 60_000;
const DAY_MS = 86_400_000;
const ZOOM_IN_FACTOR = 0.7;
// A person's assignment sub-segment hangs below the task bar's centre, one
// thin lane per assigned person.
const PERSON_LANE_OFFSET_PX = 12;
const PERSON_LANE_STEP_PX = 5;

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

/** Full date + time for tooltips, e.g. "3 Apr 2025, 14:30:05". */
function formatTimestamp(ms: number): string {
  return new Date(ms).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "medium" });
}

interface TimelinePanelProps {
  tasks: Task[];
  people: Person[];
  statuses: Record<TaskStatus, StatusConfig>;
  selectedTaskIds: ReadonlySet<string>;
  /** Select a single task and centre the canvas on it. */
  onSelectTask: (taskId: string) => void;
  onClose: () => void;
}

/** Fit a time range around all in-progress activity, with padding and `now`. */
function fitRange(tasks: Task[], now: number): TimeRange {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const task of tasks) {
    for (const { start, end } of task.inProgressIntervals ?? []) {
      min = Math.min(min, start);
      max = Math.max(max, end ?? now);
    }
  }
  if (!Number.isFinite(min)) return { start: now - DAY_MS, end: now + DAY_MS * 0.05 };
  max = Math.max(max, now);
  const pad = Math.max((max - min) * 0.05, MIN_SPAN_MS);
  return { start: min - pad, end: max + pad };
}

function clampSpan(range: TimeRange): TimeRange {
  const span = range.end - range.start;
  if (span >= MIN_SPAN_MS) return range;
  const mid = (range.start + range.end) / 2;
  return { start: mid - MIN_SPAN_MS / 2, end: mid + MIN_SPAN_MS / 2 };
}

function formatTickLabel(t: number, step: number): string {
  const date = new Date(t);
  if (step >= DAY_MS) {
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }
  return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export function TimelinePanel({
  tasks,
  people,
  statuses,
  selectedTaskIds,
  onSelectTask,
  onClose,
}: TimelinePanelProps) {
  const now = useNow(10_000);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(DEFAULT_HEIGHT);
  const [isExpanded, setIsExpanded] = useState(false);
  const resizeRef = useRef<{ startY: number; startHeight: number } | null>(null);

  const toggleExpand = useCallback(() => {
    if (isExpanded) {
      setHeight(DEFAULT_HEIGHT);
      setIsExpanded(false);
    } else {
      setHeight(Math.floor(window.innerHeight * EXPANDED_HEIGHT_RATIO));
      setIsExpanded(true);
    }
  }, [isExpanded]);

  // Tasks with any in-progress history, earliest first.
  const timelineTasks = useMemo(() => {
    const list = tasksWithInProgressHistory(tasks);
    return list.sort((a, b) => {
      const aStart = a.inProgressIntervals?.[0]?.start ?? 0;
      const bStart = b.inProgressIntervals?.[0]?.start ?? 0;
      return aStart - bStart;
    });
  }, [tasks]);

  // The visible time window. Initialized once from the data; the user then
  // controls it with zoom/pan/fit (live data changes don't reset it).
  const [range, setRange] = useState<TimeRange>(() => fitRange(timelineTasks, Date.now()));

  const personById = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);

  const zoomAt = useCallback((anchor: number, factor: number) => {
    setRange((r) => clampSpan(zoomTimeRange(r, anchor, factor)));
  }, []);

  // Wheel over the track area zooms; over the labels it scrolls normally.
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const rect = el.getBoundingClientRect();
      const trackLeft = rect.left + LABEL_WIDTH;
      const trackWidth = rect.width - LABEL_WIDTH;
      if (trackWidth <= 0 || e.clientX < trackLeft) return;
      e.preventDefault();
      const anchor = (e.clientX - trackLeft) / trackWidth;
      zoomAt(anchor, wheelZoomFactor(e.deltaY, e.deltaMode));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  const handleAxisPanStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const width = (e.currentTarget as HTMLElement).getBoundingClientRect().width;
      const startRange = range;
      const onMove = (ev: MouseEvent) => {
        const deltaFraction = (ev.clientX - startX) / width;
        setRange(panTimeRange(startRange, -deltaFraction));
      };
      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [range],
  );

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      resizeRef.current = { startY: e.clientY, startHeight: height };
      const onMove = (ev: MouseEvent) => {
        if (!resizeRef.current) return;
        const delta = ev.clientY - resizeRef.current.startY;
        setHeight(
          Math.max(160, Math.min(window.innerHeight * 0.9, resizeRef.current.startHeight + delta)),
        );
      };
      const onUp = () => {
        resizeRef.current = null;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [height],
  );

  const step = chooseTickStep(range.end - range.start, MAX_TICKS);
  const ticks = generateTicks(range, step);
  const nowFraction = timeToFraction(now, range);

  return (
    <div
      className="tl-overlay"
      style={{ height, "--tl-label-width": `${LABEL_WIDTH}px` } as React.CSSProperties}
    >
      <div className="tl-header">
        <span className="tl-title">Timeline — In Progress</span>
        <div className="tl-controls">
          <button
            type="button"
            className="tl-ctrl-btn"
            onClick={() => zoomAt(0.5, 1 / ZOOM_IN_FACTOR)}
            aria-label="Zoom out"
            title="Zoom out"
          >
            <Minus size={15} />
          </button>
          <button
            type="button"
            className="tl-ctrl-btn"
            onClick={() => zoomAt(0.5, ZOOM_IN_FACTOR)}
            aria-label="Zoom in"
            title="Zoom in"
          >
            <Plus size={15} />
          </button>
          <button
            type="button"
            className="tl-ctrl-btn"
            onClick={() => setRange(fitRange(timelineTasks, now))}
            aria-label="Fit to content"
            title="Fit to content"
          >
            <Maximize size={15} />
          </button>
          <button
            type="button"
            className="tl-ctrl-btn tl-close-btn"
            onClick={onClose}
            aria-label="Close timeline"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="tl-body" ref={bodyRef}>
        {timelineTasks.length === 0 ? (
          <div className="tl-empty">No tasks have been In Progress yet.</div>
        ) : (
          <div className="tl-grid">
            <div className="tl-axis-row">
              <div className="tl-corner">Task</div>
              <div
                className="tl-axis"
                onMouseDown={handleAxisPanStart}
                title="Drag to pan · scroll to zoom"
              >
                {ticks.map((t) => (
                  <span
                    key={t}
                    className="tl-axis-tick"
                    style={{ left: `${timeToFraction(t, range) * 100}%` }}
                  >
                    {formatTickLabel(t, step)}
                  </span>
                ))}
              </div>
            </div>

            <div className="tl-rows">
              {timelineTasks.map((task) => {
                const seq = tasks.indexOf(task) + 1;
                const assignedIds = task.assignedPersonIds ?? [];
                const isSelected = selectedTaskIds.has(task.id);
                return (
                  <div key={task.id} className={`tl-row ${isSelected ? "selected" : ""}`}>
                    <div className="tl-label">
                      <button
                        type="button"
                        className="tl-task-head"
                        onClick={() => onSelectTask(task.id)}
                        title={task.text || "(untitled)"}
                      >
                        <span className="tl-status-emoji">{statuses[task.status]?.emoji}</span>
                        <span className="tl-seq">{seq}</span>
                        <span className="tl-task-text">{task.text || "(untitled)"}</span>
                        <span className="tl-task-total">
                          {formatDurationShort(totalInProgressMs(task, now))}
                        </span>
                      </button>
                      {assignedIds.map((personId) => {
                        const person = personById.get(personId);
                        if (!person) return null;
                        return (
                          <div key={personId} className="tl-person">
                            <PersonAvatar person={person} size={18} />
                            <span className="tl-person-name">{person.name || "(unnamed)"}</span>
                            <span className="tl-person-time">
                              {formatDurationShort(personInProgressMs(task, personId, now))}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    <div className="tl-track">
                      {ticks.map((t) => (
                        <span
                          key={t}
                          className="tl-gridline"
                          style={{ left: `${timeToFraction(t, range) * 100}%` }}
                        />
                      ))}
                      {(task.inProgressIntervals ?? []).map((interval) => {
                        const left = clamp01(timeToFraction(interval.start, range));
                        const right = clamp01(timeToFraction(interval.end ?? now, range));
                        const width = Math.max(0, right - left);
                        const ongoing = interval.end === null;
                        const endText = ongoing ? "<now>" : formatTimestamp(interval.end as number);
                        return (
                          <div
                            key={interval.start}
                            className={`tl-block ${ongoing ? "ongoing" : ""}`}
                            style={{ left: `${left * 100}%`, width: `${width * 100}%` }}
                            title={`${formatTimestamp(interval.start)} → ${endText}`}
                          />
                        );
                      })}
                      {assignedIds.flatMap((personId, personIndex) => {
                        const assignedAt = task.assignedAt?.[personId];
                        if (assignedAt === undefined) return [];
                        const person = personById.get(personId);
                        const name = person?.name || "(unnamed)";
                        const top = `calc(50% + ${PERSON_LANE_OFFSET_PX + personIndex * PERSON_LANE_STEP_PX}px)`;
                        return (task.inProgressIntervals ?? []).map((interval) => {
                          const segStart = Math.max(interval.start, assignedAt);
                          const segEnd = interval.end ?? now;
                          if (segEnd <= segStart) return null;
                          const left = clamp01(timeToFraction(segStart, range));
                          const right = clamp01(timeToFraction(segEnd, range));
                          const width = right - left;
                          if (width <= 0) return null;
                          const endText =
                            interval.end === null ? "<now>" : formatTimestamp(interval.end);
                          return (
                            <span
                              key={`${personId}-${interval.start}`}
                              className="tl-person-seg"
                              style={{
                                left: `${left * 100}%`,
                                width: `${width * 100}%`,
                                top,
                                background: avatarColor(personId),
                              }}
                              title={`${name}: ${formatTimestamp(segStart)} → ${endText}`}
                            />
                          );
                        });
                      })}
                      {(task.inProgressIntervals ?? [])
                        .flatMap((interval, i) => {
                          const marks: { at: number; status: TaskStatus; key: string }[] = [
                            { at: interval.start, status: "in_progress", key: `s${i}` },
                          ];
                          if (interval.end !== null && interval.endStatus) {
                            marks.push({
                              at: interval.end,
                              status: interval.endStatus,
                              key: `e${i}`,
                            });
                          }
                          return marks;
                        })
                        .map((mark) => {
                          const frac = timeToFraction(mark.at, range);
                          if (frac < 0 || frac > 1) return null;
                          const cfg = statuses[mark.status];
                          return (
                            <span
                              key={mark.key}
                              className="tl-marker"
                              style={
                                {
                                  left: `${frac * 100}%`,
                                  "--tl-marker-color": cfg?.color,
                                } as React.CSSProperties
                              }
                            >
                              <span className="tl-marker-emoji" title={cfg?.label}>
                                {cfg?.emoji}
                              </span>
                            </span>
                          );
                        })}
                      {nowFraction >= 0 && nowFraction <= 1 && (
                        <span className="tl-now-line" style={{ left: `${nowFraction * 100}%` }} />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="tl-drag-handle" onMouseDown={handleResizeStart} />
      <div className="tl-footer">
        <button
          type="button"
          className="tl-expand-btn"
          onClick={toggleExpand}
          aria-label={isExpanded ? "Reset timeline size" : "Expand timeline"}
          title={isExpanded ? "Reset size" : "Expand"}
        >
          {isExpanded ? "⊡" : "⊞"}
        </button>
        <button
          type="button"
          className="tl-collapse-btn"
          onClick={onClose}
          aria-label="Close timeline"
        >
          ∧
        </button>
      </div>
    </div>
  );
}
