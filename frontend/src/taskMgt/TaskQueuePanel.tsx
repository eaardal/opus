import { useState, useRef } from "react";
import "./TaskQueuePanel.css";
import { Task } from "./Sidebar";
import { Person } from "../teamMgt/types";
import { PersonTaskQueue, TaskQueueEntry } from "../workspace/types";
import { avatarColor } from "../shared/avatarUtils";
import { CategoryConfig, StatusConfig } from "./theme";
import { TaskStatus } from "./Sidebar";

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
                      <span
                        className="tq-picker-dot"
                        style={{ background: categoryConfig.color }}
                        title={categoryConfig.label}
                      />
                    )}
                    <span
                      className="tq-picker-dot"
                      style={{ background: statusConfig.color, outline: "1px solid rgba(0,0,0,0.15)" }}
                      title={statusConfig.label}
                    />
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

interface PersonPickerProps {
  people: Person[];
  position: { x: number; y: number };
  onSelect: (personId: string) => void;
  onClose: () => void;
}

function PersonPicker({ people, position, onSelect, onClose }: PersonPickerProps) {
  return (
    <>
      <div className="tq-picker-backdrop" onClick={onClose} />
      <div
        className="tq-person-picker-popup"
        style={{ position: "fixed", left: position.x, top: position.y }}
        onClick={e => e.stopPropagation()}
      >
        {people.length === 0 ? (
          <div className="tq-picker-empty">All people are in the queue</div>
        ) : (
          people.map(person => (
            <button key={person.id} className="tq-picker-item tq-picker-person-item" onClick={() => { onSelect(person.id); onClose(); }}>
              <PersonAvatar person={person} size={20} />
              <span>{person.name || "(unnamed)"}</span>
            </button>
          ))
        )}
      </div>
    </>
  );
}

interface TaskCardProps {
  task: Task;
  seqNum: number;
  categories: Record<string, CategoryConfig>;
  statuses: Record<TaskStatus, StatusConfig>;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  onRemove: () => void;
}

function TaskCard({ task, seqNum, categories, statuses, draggable, onDragStart, onDragEnd, onDragOver, onDrop, onRemove }: TaskCardProps) {
  const statusConfig = statuses[task.status] ?? statuses.pending;
  const categoryConfig = task.category ? categories[task.category] : null;
  const accentColor = categoryConfig?.color ?? statusConfig.color;

  return (
    <div
      className="tq-task-card"
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
      style={{ borderLeftColor: accentColor }}
    >
      <span className="tq-card-seq">#{seqNum}</span>
      <span className="tq-card-emoji" title={statusConfig.label}>{statusConfig.emoji}</span>
      <span className="tq-task-text">{task.text || "(unnamed)"}</span>
      <button className="tq-task-remove" onClick={onRemove} tabIndex={-1}>×</button>
    </div>
  );
}

interface DragSource {
  personId: string;
  source: "current" | "queue";
  taskId: string;
  index: number;
}

interface TaskQueuePanelProps {
  taskQueues: PersonTaskQueue[];
  tasks: Task[];
  people: Person[];
  categories: Record<string, CategoryConfig>;
  statuses: Record<TaskStatus, StatusConfig>;
  onTaskQueuesChange: (queues: PersonTaskQueue[]) => void;
  onAssignPersonToTask: (taskId: string, personIds: string[]) => void;
  onClose: () => void;
}

export function TaskQueuePanel({
  taskQueues,
  tasks,
  people,
  categories,
  statuses,
  onTaskQueuesChange,
  onAssignPersonToTask,
  onClose,
}: TaskQueuePanelProps) {
  const dragSourceRef = useRef<DragSource | null>(null);
  const [dropTarget, setDropTarget] = useState<{ personId: string; target: "current" | "queue" } | null>(null);
  const [taskPickerState, setTaskPickerState] = useState<{
    personId: string;
    target: "current" | "queue";
    position: { x: number; y: number };
  } | null>(null);
  const [personPickerPosition, setPersonPickerPosition] = useState<{ x: number; y: number } | null>(null);

  const peopleInQueue = new Set(taskQueues.map(q => q.personId));
  const availablePeople = people.filter(p => !peopleInQueue.has(p.id));

  const updateQueue = (personId: string, update: Partial<PersonTaskQueue>) => {
    onTaskQueuesChange(taskQueues.map(q => q.personId === personId ? { ...q, ...update } : q));
  };

  const addPerson = (personId: string) => {
    onTaskQueuesChange([...taskQueues, { personId, currentTasks: [], queuedTasks: [] }]);
  };

  const removePerson = (personId: string) => {
    onTaskQueuesChange(taskQueues.filter(q => q.personId !== personId));
  };

  const addTaskToSlot = (personId: string, taskId: string, target: "current" | "queue") => {
    const queue = taskQueues.find(q => q.personId === personId);
    if (!queue) return;

    if (target === "current") {
      updateQueue(personId, { currentTasks: [...queue.currentTasks, { taskId }] });
      const task = tasks.find(t => t.id === taskId);
      if (task) {
        const existing = task.assignedPersonIds ?? [];
        if (!existing.includes(personId)) {
          onAssignPersonToTask(taskId, [...existing, personId]);
        }
      }
    } else {
      updateQueue(personId, { queuedTasks: [...queue.queuedTasks, { taskId }] });
    }
  };

  const removeTaskFromSlot = (personId: string, taskId: string, source: "current" | "queue") => {
    const queue = taskQueues.find(q => q.personId === personId);
    if (!queue) return;
    if (source === "current") {
      updateQueue(personId, { currentTasks: queue.currentTasks.filter(e => e.taskId !== taskId) });
    } else {
      updateQueue(personId, { queuedTasks: queue.queuedTasks.filter(e => e.taskId !== taskId) });
    }
  };

  const handleDragStart = (e: React.DragEvent, personId: string, source: "current" | "queue", taskId: string, index: number) => {
    dragSourceRef.current = { personId, source, taskId, index };
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, personId: string, target: "current" | "queue") => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropTarget({ personId, target });
  };

  const handleDrop = (e: React.DragEvent, personId: string, target: "current" | "queue", insertIndex: number) => {
    e.preventDefault();
    setDropTarget(null);
    const drag = dragSourceRef.current;
    if (!drag) return;

    const queue = taskQueues.find(q => q.personId === personId);
    if (!queue) return;

    let newCurrent = [...queue.currentTasks];
    let newQueued = [...queue.queuedTasks];

    if (drag.source === "current") {
      newCurrent = newCurrent.filter(e => e.taskId !== drag.taskId);
    } else {
      newQueued = newQueued.filter(e => e.taskId !== drag.taskId);
    }

    const entry: TaskQueueEntry = { taskId: drag.taskId };
    if (target === "current") {
      newCurrent.splice(insertIndex, 0, entry);
    } else {
      newQueued.splice(insertIndex, 0, entry);
    }

    onTaskQueuesChange(taskQueues.map(q => q.personId === personId ? { ...q, currentTasks: newCurrent, queuedTasks: newQueued } : q));

    if (target === "current" && drag.source !== "current") {
      const task = tasks.find(t => t.id === drag.taskId);
      if (task) {
        const existing = task.assignedPersonIds ?? [];
        if (!existing.includes(personId)) {
          onAssignPersonToTask(drag.taskId, [...existing, personId]);
        }
      }
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

  const openPersonPicker = (e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = Math.min(rect.left, window.innerWidth - PICKER_WIDTH - 8);
    setPersonPickerPosition({ x, y: rect.bottom + 4 });
  };

  const getQueuedTaskIds = (personId: string): Set<string> => {
    const queue = taskQueues.find(q => q.personId === personId);
    if (!queue) return new Set();
    return new Set([...queue.currentTasks.map(e => e.taskId), ...queue.queuedTasks.map(e => e.taskId)]);
  };

  return (
    <div className="task-queue-overlay">
      <div className="tq-swimlanes">
        {taskQueues.map(queue => {
          const person = people.find(p => p.id === queue.personId);
          if (!person) return null;
          const queuedIds = getQueuedTaskIds(queue.personId);
          const isCurrentDrop = dropTarget?.personId === queue.personId && dropTarget?.target === "current";
          const isQueueDrop = dropTarget?.personId === queue.personId && dropTarget?.target === "queue";

          return (
            <div key={queue.personId} className="tq-swimlane">
              <div className="tq-person-col">
                <PersonAvatar person={person} size={36} />
                <span className="tq-person-name">{person.name || "(unnamed)"}</span>
              </div>
              <button className="tq-remove-person" onClick={() => removePerson(queue.personId)} aria-label="Remove from queue">×</button>

              <div className="tq-current-section">
                <div className="tq-section-label">Current task</div>
                <div
                  className={`tq-tasks-row ${isCurrentDrop ? "tq-drop-active" : ""}`}
                  onDragOver={e => handleDragOver(e, queue.personId, "current")}
                  onDrop={e => handleDrop(e, queue.personId, "current", queue.currentTasks.length)}
                >
                  {queue.currentTasks.map((entry, idx) => {
                    const task = tasks.find(t => t.id === entry.taskId);
                    if (!task) return null;
                    const seqNum = tasks.indexOf(task) + 1;
                    return (
                      <TaskCard
                        key={entry.taskId}
                        task={task}
                        seqNum={seqNum}
                        categories={categories}
                        statuses={statuses}
                        draggable
                        onDragStart={e => handleDragStart(e, queue.personId, "current", entry.taskId, idx)}
                        onDragEnd={handleDragEnd}
                        onDragOver={e => { e.stopPropagation(); handleDragOver(e, queue.personId, "current"); }}
                        onDrop={e => { e.stopPropagation(); handleDrop(e, queue.personId, "current", idx); }}
                        onRemove={() => removeTaskFromSlot(queue.personId, entry.taskId, "current")}
                      />
                    );
                  })}
                  {queue.currentTasks.length === 0 && (
                    <button className="tq-add-task-btn" onClick={e => openTaskPicker(e, queue.personId, "current")}>
                      <span className="tq-add-task-icon">+</span> Add task
                    </button>
                  )}
                </div>
              </div>

              <div className="tq-section-divider" />

              <div className="tq-queue-section">
                <div className="tq-section-header">
                  <div className="tq-section-label">Queue</div>
                  <button
                    className="tq-add-more-btn"
                    onClick={e => openTaskPicker(e, queue.personId, "queue")}
                    aria-label="Add task to queue"
                    title="Add task to queue"
                  >
                    +
                  </button>
                </div>
                <div
                  className={`tq-tasks-row ${isQueueDrop ? "tq-drop-active" : ""}`}
                  onDragOver={e => handleDragOver(e, queue.personId, "queue")}
                  onDrop={e => handleDrop(e, queue.personId, "queue", queue.queuedTasks.length)}
                >
                  {queue.queuedTasks.map((entry, idx) => {
                    const task = tasks.find(t => t.id === entry.taskId);
                    if (!task) return null;
                    const seqNum = tasks.indexOf(task) + 1;
                    return (
                      <TaskCard
                        key={entry.taskId}
                        task={task}
                        seqNum={seqNum}
                        categories={categories}
                        statuses={statuses}
                        draggable
                        onDragStart={e => handleDragStart(e, queue.personId, "queue", entry.taskId, idx)}
                        onDragEnd={handleDragEnd}
                        onDragOver={e => { e.stopPropagation(); handleDragOver(e, queue.personId, "queue"); }}
                        onDrop={e => { e.stopPropagation(); handleDrop(e, queue.personId, "queue", idx); }}
                        onRemove={() => removeTaskFromSlot(queue.personId, entry.taskId, "queue")}
                      />
                    );
                  })}
                  {queue.queuedTasks.length === 0 && (
                    <button className="tq-add-task-btn" onClick={e => openTaskPicker(e, queue.personId, "queue")}>
                      <span className="tq-add-task-icon">+</span> Add task
                    </button>
                  )}
                </div>
              </div>

              {taskPickerState?.personId === queue.personId && (
                <TaskPicker
                  tasks={tasks}
                  excludeIds={queuedIds}
                  position={taskPickerState.position}
                  categories={categories}
                  statuses={statuses}
                  onSelect={taskId => addTaskToSlot(queue.personId, taskId, taskPickerState.target)}
                  onClose={() => setTaskPickerState(null)}
                />
              )}
            </div>
          );
        })}

        <div className="tq-add-person-lane">
          <button className="tq-add-person-btn" onClick={openPersonPicker}>
            <span className="tq-add-person-icon">+</span>
            Add person to Task Queue
          </button>
        </div>
      </div>

      <button className="tq-collapse-btn" onClick={onClose} aria-label="Collapse task queue">
        ∧
      </button>

      {personPickerPosition && (
        <PersonPicker
          people={availablePeople}
          position={personPickerPosition}
          onSelect={addPerson}
          onClose={() => setPersonPickerPosition(null)}
        />
      )}
    </div>
  );
}
