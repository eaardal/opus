import { useState, useRef, useCallback, useEffect } from "react";
import "./TaskQueuePanel.css";
import { Task, Group } from "./Sidebar";
import { Connection } from "./Canvas";
import { Person } from "../teamMgt/types";
import { avatarColor } from "../shared/avatarUtils";
import { CategoryConfig, StatusConfig } from "./theme";
import { TaskStatus } from "./Sidebar";

const DEFAULT_HEIGHT = 340;
const EXPANDED_HEIGHT_RATIO = 0.8;

interface PersonAvatarProps {
  person: Person;
  size: number;
}

function PersonAvatar({ person, size }: PersonAvatarProps) {
  const initials = person.name.trim() ? person.name.trim()[0].toUpperCase() : "?";
  const baseStyle: React.CSSProperties = { width: size, height: size, borderRadius: "50%", flexShrink: 0 };
  return person.picture ? (
    <img style={{ ...baseStyle, objectFit: "cover" }} src={person.picture} alt={person.name} />
  ) : (
    <span style={{
      ...baseStyle,
      background: avatarColor(person.id),
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: size * 0.45,
      fontWeight: 600,
      color: "#fff",
    }}>
      {initials}
    </span>
  );
}

interface TaskPickerProps {
  tasks: Task[];
  excludeIds: Set<string>;
  position: { x: number; y: number };
  categories: Record<string, CategoryConfig>;
  statuses: Record<TaskStatus, StatusConfig>;
  onSelect: (taskId: string) => void;
  onClose: () => void;
}

function matchesFilter(task: Task, seqNum: number, raw: string): boolean {
  const lower = raw.toLowerCase().trim();
  if (!lower) return true;
  const numQuery = lower.startsWith("#") ? lower.slice(1) : lower;
  if (/^\d+$/.test(numQuery) && String(seqNum).includes(numQuery)) return true;
  return (task.text || "").toLowerCase().includes(lower);
}

function TaskPicker({ tasks, excludeIds, position, categories, statuses, onSelect, onClose }: TaskPickerProps) {
  const [filter, setFilter] = useState("");
  const filtered = tasks
    .map((t, i) => ({ task: t, seq: i + 1 }))
    .filter(({ task, seq }) => !excludeIds.has(task.id) && matchesFilter(task, seq, filter));

  return (
    <>
      <div className="tq-picker-backdrop" onClick={onClose} />
      <div
        className="tq-task-picker"
        style={{ position: "fixed", left: position.x, top: position.y }}
        onClick={e => e.stopPropagation()}
      >
        <input
          className="tq-picker-filter"
          placeholder="Filter by name or #number..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
          autoFocus
          onKeyDown={e => { if (e.key === "Escape") onClose(); e.stopPropagation(); }}
        />
        <div className="tq-picker-list">
          {filtered.length === 0 ? (
            <div className="tq-picker-empty">No tasks found</div>
          ) : (
            filtered.map(({ task, seq }) => {
              const statusConfig = statuses[task.status];
              const categoryConfig = task.category ? categories[task.category] : null;
              return (
                <button
                  key={task.id}
                  className="tq-picker-item tq-picker-task-item"
                  onClick={() => { onSelect(task.id); onClose(); }}
                >
                  <span className="tq-picker-seq">#{seq}</span>
                  <span className="tq-picker-task-text">{task.text || "(unnamed task)"}</span>
                  <span className="tq-picker-badges">
                    {categoryConfig && (
                      <span className="tq-picker-dot" style={{ background: categoryConfig.color }} title={categoryConfig.label} />
                    )}
                    <span className="tq-picker-dot" style={{ background: statusConfig.color, outline: "1px solid rgba(0,0,0,0.15)" }} title={statusConfig.label} />
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}

interface TaskCardProps {
  task: Task;
  seqNum: number;
  groupTitle: string | null;
  isHighlighted: boolean;
  categories: Record<string, CategoryConfig>;
  statuses: Record<TaskStatus, StatusConfig>;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  onRemove: () => void;
  onClick: () => void;
}

function TaskCard({ task, seqNum, groupTitle, isHighlighted, categories, statuses, draggable, onDragStart, onDragEnd, onDragOver, onDrop, onRemove, onClick }: TaskCardProps) {
  const statusConfig = statuses[task.status] ?? statuses.pending;
  const categoryConfig = task.category ? categories[task.category] : null;
  const accentColor = categoryConfig?.color ?? statusConfig.color;

  return (
    <div
      className={`tq-task-card${isHighlighted ? " tq-task-card--highlighted" : ""}`}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onClick={onClick}
      style={{ borderLeftColor: accentColor }}
    >
      <div className="tq-card-badge">
        <span className="tq-card-seq">#{seqNum}</span>
        <span className="tq-card-emoji" title={statusConfig.label}>{statusConfig.emoji}</span>
      </div>
      {groupTitle && <span className="tq-card-group" title={groupTitle}>{groupTitle}</span>}
      <div className="tq-card-main">
        <span className="tq-task-text">{task.text || "(unnamed)"}</span>
        <button className="tq-task-remove" onClick={e => { e.stopPropagation(); onRemove(); }} tabIndex={-1}>×</button>
      </div>
    </div>
  );
}

interface BlockerCardProps {
  task: Task;
  seqNum: number;
  groupTitle: string | null;
  assignedPeople: Person[];
  isHighlighted: boolean;
  categories: Record<string, CategoryConfig>;
  statuses: Record<TaskStatus, StatusConfig>;
  onClick: () => void;
}

function BlockerCard({ task, seqNum, groupTitle, assignedPeople, isHighlighted, categories, statuses, onClick }: BlockerCardProps) {
  const statusConfig = statuses[task.status] ?? statuses.pending;
  const categoryConfig = task.category ? categories[task.category] : null;
  const accentColor = categoryConfig?.color ?? statusConfig.color;

  return (
    <div
      className={`tq-task-card tq-blocker-card${isHighlighted ? " tq-task-card--highlighted" : ""}`}
      onClick={onClick}
      style={{ borderLeftColor: accentColor }}
    >
      <div className="tq-card-badge">
        <span className="tq-card-seq">#{seqNum}</span>
        <span className="tq-card-emoji" title={statusConfig.label}>{statusConfig.emoji}</span>
      </div>
      {groupTitle && <span className="tq-card-group" title={groupTitle}>{groupTitle}</span>}
      <div className="tq-card-main">
        <span className="tq-task-text">{task.text || "(unnamed)"}</span>
      </div>
      {assignedPeople.length > 0 && (
        <div className="tq-blocker-assignees">
          {assignedPeople.map(p => (
            <PersonAvatar key={p.id} person={p} size={14} />
          ))}
          <span className="tq-blocker-assignee-names">
            {assignedPeople.map(p => p.name || "?").join(", ")}
          </span>
        </div>
      )}
    </div>
  );
}

interface DragSource {
  personId: string;
  source: "current" | "queue";
  taskId: string;
}

interface TaskQueuePanelProps {
  tasks: Task[];
  groups: Group[];
  connections: Connection[];
  people: Person[];
  categories: Record<string, CategoryConfig>;
  statuses: Record<TaskStatus, StatusConfig>;
  highlightedTaskId: string | null;
  onAssignPersonToTask: (taskId: string, personIds: string[]) => void;
  onAssignPersonAndSetInProgress: (taskId: string, personId: string) => void;
  onSetTaskStatus: (taskId: string, status: TaskStatus) => void;
  onHighlightTask: (taskId: string | null) => void;
  onClose: () => void;
}

export function TaskQueuePanel({
  tasks,
  groups,
  connections,
  people,
  categories,
  statuses,
  highlightedTaskId,
  onAssignPersonToTask,
  onAssignPersonAndSetInProgress,
  onSetTaskStatus,
  onHighlightTask,
  onClose,
}: TaskQueuePanelProps) {
  const dragSourceRef = useRef<DragSource | null>(null);
  const [dropTarget, setDropTarget] = useState<{ personId: string; target: "current" | "queue" } | null>(null);
  const [height, setHeight] = useState(DEFAULT_HEIGHT);
  const [isExpanded, setIsExpanded] = useState(false);
  const resizeDragRef = useRef<{ startY: number; startHeight: number } | null>(null);

  const handleResizeDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    resizeDragRef.current = { startY: e.clientY, startHeight: height };

    const onMouseMove = (ev: MouseEvent) => {
      if (!resizeDragRef.current) return;
      const delta = ev.clientY - resizeDragRef.current.startY;
      const next = Math.max(120, Math.min(window.innerHeight * 0.9, resizeDragRef.current.startHeight + delta));
      setHeight(next);
      setIsExpanded(false);
    };

    const onMouseUp = () => {
      resizeDragRef.current = null;
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }, [height]);

  const toggleExpand = useCallback(() => {
    if (isExpanded) {
      setHeight(DEFAULT_HEIGHT);
      setIsExpanded(false);
    } else {
      setHeight(Math.floor(window.innerHeight * EXPANDED_HEIGHT_RATIO));
      setIsExpanded(true);
    }
  }, [isExpanded]);

  const getGroupTitle = (task: Task): string | null => {
    const group = groups.find(g =>
      task.x >= g.x && task.x <= g.x + g.width &&
      task.y >= g.y && task.y <= g.y + g.height
    );
    return group?.title || null;
  };

  const getBlockingTasks = (personId: string): { task: Task; assignedPeople: Person[] }[] => {
    const personTasks = tasks.filter(t =>
      (t.status === "pending" || t.status === "in_progress") &&
      (t.assignedPersonIds ?? []).includes(personId)
    );
    const blockerIds = new Set<string>();
    for (const task of personTasks) {
      for (const conn of connections) {
        if (conn.to === task.id) {
          const blocker = tasks.find(t => t.id === conn.from);
          if (blocker && blocker.status !== "completed" && blocker.status !== "archived" && !(blocker.assignedPersonIds ?? []).includes(personId)) {
            blockerIds.add(blocker.id);
          }
        }
      }
    }
    return [...blockerIds].map(id => {
      const task = tasks.find(t => t.id === id)!;
      const assignedPeople = (task.assignedPersonIds ?? [])
        .map(pid => people.find(p => p.id === pid))
        .filter((p): p is Person => p !== undefined);
      return { task, assignedPeople };
    });
  };

  const [taskPickerState, setTaskPickerState] = useState<{
    personId: string;
    target: "current" | "queue";
    position: { x: number; y: number };
  } | null>(null);

  // Derive swimlane people from task assignments
  const personIds = new Set<string>();
  for (const task of tasks) {
    if (task.status === "completed" || task.status === "archived") continue;
    for (const personId of task.assignedPersonIds ?? []) {
      personIds.add(personId);
    }
  }
  const swimlanePeople = [...personIds]
    .map(id => people.find(p => p.id === id))
    .filter((p): p is Person => p !== undefined);

  // Derive task lists for a person from task state
  const getInProgressTasks = (personId: string) =>
    tasks.filter(t => t.status === "in_progress" && (t.assignedPersonIds ?? []).includes(personId));

  const getQueuedTasks = (personId: string) =>
    tasks.filter(t => t.status === "pending" && (t.assignedPersonIds ?? []).includes(personId));

  const assignTaskToPerson = (taskId: string, personId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const existing = task.assignedPersonIds ?? [];
    if (!existing.includes(personId)) {
      onAssignPersonToTask(taskId, [...existing, personId]);
    }
  };

  const unassignTaskFromPerson = (taskId: string, personId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    onAssignPersonToTask(taskId, (task.assignedPersonIds ?? []).filter(id => id !== personId));
  };

  const addTaskToSlot = (personId: string, taskId: string, target: "current" | "queue") => {
    if (target === "current") {
      onAssignPersonAndSetInProgress(taskId, personId);
    } else {
      assignTaskToPerson(taskId, personId);
    }
  };

  const handleDragStart = (e: React.DragEvent, personId: string, source: "current" | "queue", taskId: string) => {
    dragSourceRef.current = { personId, source, taskId };
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, personId: string, target: "current" | "queue") => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropTarget({ personId, target });
  };

  const handleDrop = (e: React.DragEvent, personId: string, target: "current" | "queue") => {
    e.preventDefault();
    setDropTarget(null);
    const drag = dragSourceRef.current;
    if (!drag || drag.personId !== personId) return;
    if (drag.source === target) return;

    if (target === "current") {
      onSetTaskStatus(drag.taskId, "in_progress");
    } else {
      onSetTaskStatus(drag.taskId, "pending");
    }
    dragSourceRef.current = null;
  };

  const handleDragEnd = () => {
    setDropTarget(null);
    dragSourceRef.current = null;
  };

  const PICKER_WIDTH = 220;

  const openTaskPicker = (e: React.MouseEvent, personId: string, target: "current" | "queue") => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = Math.min(rect.left, window.innerWidth - PICKER_WIDTH - 8);
    setTaskPickerState({ personId, target, position: { x, y: rect.bottom + 4 } });
  };

  const getExcludedTaskIds = (personId: string): Set<string> => {
    return new Set(
      tasks
        .filter(t => (t.assignedPersonIds ?? []).includes(personId))
        .map(t => t.id)
    );
  };

  return (
    <div className="task-queue-overlay" style={{ height }}>
      <div className="tq-scroll-body">
      <div className="tq-swimlanes">
        {swimlanePeople.map(person => {
          const currentTasks = getInProgressTasks(person.id);
          const queuedTasks = getQueuedTasks(person.id);
          const blockingTasks = getBlockingTasks(person.id);
          const isCurrentDrop = dropTarget?.personId === person.id && dropTarget?.target === "current";
          const isQueueDrop = dropTarget?.personId === person.id && dropTarget?.target === "queue";

          return (
            <div key={person.id} className="tq-swimlane">
              <div className="tq-person-col">
                <PersonAvatar person={person} size={36} />
                <span className="tq-person-name">{person.name || "(unnamed)"}</span>
              </div>

              {blockingTasks.length > 0 && (
                <>
                  <div className="tq-blocked-section">
                    <div className="tq-section-label tq-section-label--blocked">Blocked by</div>
                    <div className="tq-tasks-row">
                      {blockingTasks.map(({ task, assignedPeople }) => {
                        const seqNum = tasks.indexOf(task) + 1;
                        return (
                          <BlockerCard
                            key={task.id}
                            task={task}
                            seqNum={seqNum}
                            groupTitle={getGroupTitle(task)}
                            assignedPeople={assignedPeople}
                            isHighlighted={highlightedTaskId === task.id}
                            categories={categories}
                            statuses={statuses}
                            onClick={() => onHighlightTask(highlightedTaskId === task.id ? null : task.id)}
                          />
                        );
                      })}
                    </div>
                  </div>
                  <div className="tq-section-divider" />
                </>
              )}

              <div className="tq-current-section">
                <div className="tq-section-header">
                  <div className="tq-section-label">In progress</div>
                  <button
                    className="tq-add-more-btn"
                    onClick={e => openTaskPicker(e, person.id, "current")}
                    aria-label="Add task to in progress"
                    title="Add task to in progress"
                  >
                    +
                  </button>
                </div>
                <div
                  className={`tq-tasks-row ${isCurrentDrop ? "tq-drop-active" : ""}`}
                  onDragOver={e => handleDragOver(e, person.id, "current")}
                  onDrop={e => handleDrop(e, person.id, "current")}
                >
                  {currentTasks.map(task => {
                    const seqNum = tasks.indexOf(task) + 1;
                    return (
                      <TaskCard
                        key={task.id}
                        task={task}
                        seqNum={seqNum}
                        groupTitle={getGroupTitle(task)}
                        isHighlighted={highlightedTaskId === task.id}
                        categories={categories}
                        statuses={statuses}
                        draggable
                        onDragStart={e => handleDragStart(e, person.id, "current", task.id)}
                        onDragEnd={handleDragEnd}
                        onDragOver={e => { e.stopPropagation(); handleDragOver(e, person.id, "current"); }}
                        onDrop={e => { e.stopPropagation(); handleDrop(e, person.id, "current"); }}
                        onRemove={() => unassignTaskFromPerson(task.id, person.id)}
                        onClick={() => onHighlightTask(highlightedTaskId === task.id ? null : task.id)}
                      />
                    );
                  })}
                  {currentTasks.length === 0 && (
                    <span className="tq-empty-state">No tasks added yet</span>
                  )}
                </div>
              </div>

              <div className="tq-section-divider" />

              <div className="tq-queue-section">
                <div className="tq-section-header">
                  <div className="tq-section-label">Queue</div>
                  <button
                    className="tq-add-more-btn"
                    onClick={e => openTaskPicker(e, person.id, "queue")}
                    aria-label="Add task to queue"
                    title="Add task to queue"
                  >
                    +
                  </button>
                </div>
                <div
                  className={`tq-tasks-row ${isQueueDrop ? "tq-drop-active" : ""}`}
                  onDragOver={e => handleDragOver(e, person.id, "queue")}
                  onDrop={e => handleDrop(e, person.id, "queue")}
                >
                  {queuedTasks.map(task => {
                    const seqNum = tasks.indexOf(task) + 1;
                    return (
                      <TaskCard
                        key={task.id}
                        task={task}
                        seqNum={seqNum}
                        groupTitle={getGroupTitle(task)}
                        isHighlighted={highlightedTaskId === task.id}
                        categories={categories}
                        statuses={statuses}
                        draggable
                        onDragStart={e => handleDragStart(e, person.id, "queue", task.id)}
                        onDragEnd={handleDragEnd}
                        onDragOver={e => { e.stopPropagation(); handleDragOver(e, person.id, "queue"); }}
                        onDrop={e => { e.stopPropagation(); handleDrop(e, person.id, "queue"); }}
                        onRemove={() => unassignTaskFromPerson(task.id, person.id)}
                        onClick={() => onHighlightTask(highlightedTaskId === task.id ? null : task.id)}
                      />
                    );
                  })}
                  {queuedTasks.length === 0 && (
                    <span className="tq-empty-state">No tasks added yet</span>
                  )}
                </div>
              </div>

              {taskPickerState?.personId === person.id && (
                <TaskPicker
                  tasks={tasks}
                  excludeIds={getExcludedTaskIds(person.id)}
                  position={taskPickerState.position}
                  categories={categories}
                  statuses={statuses}
                  onSelect={taskId => addTaskToSlot(person.id, taskId, taskPickerState.target)}
                  onClose={() => setTaskPickerState(null)}
                />
              )}
            </div>
          );
        })}

      </div>
      </div>

      <div className="tq-drag-handle" onMouseDown={handleResizeDragStart} />

      <div className="tq-footer">
        <button className="tq-expand-btn" onClick={toggleExpand} aria-label={isExpanded ? "Reset task queue size" : "Expand task queue"} title={isExpanded ? "Reset size" : "Expand"}>
          {isExpanded ? "⊡" : "⊞"}
        </button>
        <button className="tq-collapse-btn" onClick={onClose} aria-label="Collapse task queue">
          ∧
        </button>
      </div>
    </div>
  );
}
