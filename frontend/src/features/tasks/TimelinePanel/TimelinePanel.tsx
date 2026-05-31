import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./TimelinePanel.css";
import { Maximize, Minus, Plus } from "lucide-react";
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
import { useNow } from "../../../hooks/useNow";
import { PersonAvatar } from "../PersonAvatar";

const LABEL_WIDTH = 240;
const DEFAULT_HEIGHT = 360;
const MAX_TICKS = 8;
const MIN_SPAN_MS = 60_000;
const DAY_MS = 86_400_000;
const ZOOM_IN_FACTOR = 0.7;

interface TimelinePanelProps {
  tasks: Task[];
  people: Person[];
  statuses: Record<TaskStatus, StatusConfig>;
  highlightedTaskId: string | null;
  onHighlightTask: (taskId: string | null) => void;
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
  highlightedTaskId,
  onHighlightTask,
  onClose,
}: TimelinePanelProps) {
  const now = useNow(10_000);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(DEFAULT_HEIGHT);
  const resizeRef = useRef<{ startY: number; startHeight: number } | null>(null);

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
                const isHighlighted = highlightedTaskId === task.id;
                return (
                  <div key={task.id} className={`tl-row ${isHighlighted ? "highlighted" : ""}`}>
                    <div className="tl-label">
                      <button
                        type="button"
                        className="tl-task-head"
                        onClick={() => onHighlightTask(isHighlighted ? null : task.id)}
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
                        const startFrac = timeToFraction(interval.start, range);
                        const endFrac = timeToFraction(interval.end ?? now, range);
                        const left = Math.max(0, Math.min(1, startFrac));
                        const right = Math.max(0, Math.min(1, endFrac));
                        const width = Math.max(0, right - left);
                        const ongoing = interval.end === null;
                        const durationMs = (interval.end ?? now) - interval.start;
                        return (
                          <div
                            key={interval.start}
                            className={`tl-block ${ongoing ? "ongoing" : ""}`}
                            style={{ left: `${left * 100}%`, width: `${width * 100}%` }}
                            title={formatDurationShort(durationMs)}
                          />
                        );
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
