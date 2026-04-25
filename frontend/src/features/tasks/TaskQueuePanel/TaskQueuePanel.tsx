import { useCallback, useRef, useState } from "react";
import "./TaskQueuePanel.css";
import type { Connection, Group, Task, TaskStatus } from "../../../domain/tasks/types";
import type { Person } from "../../../domain/teams/types";
import type { CategoryConfig, StatusConfig } from "../theme";
import { findBlockerTaskIds, findSwimlanePersonIds } from "../../../domain/tasks/blockers";
import { findOwningGroup } from "../../../domain/tasks/groupGeometry";
import { assignPerson, unassignPerson } from "../../../domain/tasks/operations";
import { BlockerCard } from "./BlockerCard";
import { PersonAvatar } from "./PersonAvatar";
import { TaskCard } from "./TaskCard";
import { TaskPicker } from "./TaskPicker";

const DEFAULT_HEIGHT = 340;
const EXPANDED_HEIGHT_RATIO = 0.8;

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
  showBlockedBySection: boolean;
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
  showBlockedBySection,
  onAssignPersonToTask,
  onAssignPersonAndSetInProgress,
  onSetTaskStatus,
  onHighlightTask,
  onClose,
}: TaskQueuePanelProps) {
  const dragSourceRef = useRef<DragSource | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    personId: string;
    target: "current" | "queue";
  } | null>(null);
  const [height, setHeight] = useState(DEFAULT_HEIGHT);
  const [isExpanded, setIsExpanded] = useState(false);
  const resizeDragRef = useRef<{ startY: number; startHeight: number } | null>(null);

  const handleResizeDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      resizeDragRef.current = { startY: e.clientY, startHeight: height };

      const onMouseMove = (ev: MouseEvent) => {
        if (!resizeDragRef.current) return;
        const delta = ev.clientY - resizeDragRef.current.startY;
        const next = Math.max(
          120,
          Math.min(window.innerHeight * 0.9, resizeDragRef.current.startHeight + delta),
        );
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
    },
    [height],
  );

  const toggleExpand = useCallback(() => {
    if (isExpanded) {
      setHeight(DEFAULT_HEIGHT);
      setIsExpanded(false);
    } else {
      setHeight(Math.floor(window.innerHeight * EXPANDED_HEIGHT_RATIO));
      setIsExpanded(true);
    }
  }, [isExpanded]);

  const getGroupTitle = (task: Task): string | null => findOwningGroup(task, groups)?.title || null;

  const getBlockingTasks = (personId: string): { task: Task; assignedPeople: Person[] }[] => {
    const blockerIds = findBlockerTaskIds({ tasks, connections, personId });
    return [...blockerIds].flatMap((id) => {
      const task = tasks.find((t) => t.id === id);
      if (!task) return [];
      const assignedPeople = (task.assignedPersonIds ?? [])
        .map((pid) => people.find((p) => p.id === pid))
        .filter((p): p is Person => p !== undefined);
      return [{ task, assignedPeople }];
    });
  };

  const [taskPickerState, setTaskPickerState] = useState<{
    personId: string;
    target: "current" | "queue";
    position: { x: number; y: number };
  } | null>(null);

  // Derive swimlane people from task assignments
  const swimlanePeople = [...findSwimlanePersonIds(tasks)]
    .map((id) => people.find((p) => p.id === id))
    .filter((p): p is Person => p !== undefined);

  // Derive task lists for a person from task state
  const getInProgressTasks = (personId: string) =>
    tasks.filter(
      (t) => t.status === "in_progress" && (t.assignedPersonIds ?? []).includes(personId),
    );

  const getQueuedTasks = (personId: string) =>
    tasks.filter((t) => t.status === "pending" && (t.assignedPersonIds ?? []).includes(personId));

  const assignTaskToPerson = (taskId: string, personId: string) => {
    const updated = assignPerson(tasks, taskId, personId);
    const task = updated.find((t) => t.id === taskId);
    if (task) onAssignPersonToTask(taskId, task.assignedPersonIds ?? []);
  };

  const unassignTaskFromPerson = (taskId: string, personId: string) => {
    const updated = unassignPerson(tasks, taskId, personId);
    const task = updated.find((t) => t.id === taskId);
    if (task) onAssignPersonToTask(taskId, task.assignedPersonIds ?? []);
  };

  const addTaskToSlot = (personId: string, taskId: string, target: "current" | "queue") => {
    if (target === "current") {
      onAssignPersonAndSetInProgress(taskId, personId);
    } else {
      assignTaskToPerson(taskId, personId);
    }
  };

  const handleDragStart = (
    e: React.DragEvent,
    personId: string,
    source: "current" | "queue",
    taskId: string,
  ) => {
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
      tasks.filter((t) => (t.assignedPersonIds ?? []).includes(personId)).map((t) => t.id),
    );
  };

  return (
    <div className="task-queue-overlay" style={{ height }}>
      <div className="tq-scroll-body">
        <div className="tq-swimlanes">
          {swimlanePeople.map((person) => {
            const currentTasks = getInProgressTasks(person.id);
            const queuedTasks = getQueuedTasks(person.id);
            const blockingTasks = getBlockingTasks(person.id);
            const isCurrentDrop =
              dropTarget?.personId === person.id && dropTarget?.target === "current";
            const isQueueDrop =
              dropTarget?.personId === person.id && dropTarget?.target === "queue";

            return (
              <div key={person.id} className="tq-swimlane">
                <div className="tq-person-col">
                  <PersonAvatar person={person} size={36} />
                  <span className="tq-person-name">{person.name || "(unnamed)"}</span>
                </div>

                {showBlockedBySection && blockingTasks.length > 0 && (
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
                              onClick={() =>
                                onHighlightTask(highlightedTaskId === task.id ? null : task.id)
                              }
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
                      onClick={(e) => openTaskPicker(e, person.id, "current")}
                      aria-label="Add task to in progress"
                      title="Add task to in progress"
                    >
                      +
                    </button>
                  </div>
                  <div
                    className={`tq-tasks-row ${isCurrentDrop ? "tq-drop-active" : ""}`}
                    onDragOver={(e) => handleDragOver(e, person.id, "current")}
                    onDrop={(e) => handleDrop(e, person.id, "current")}
                  >
                    {currentTasks.map((task) => {
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
                          onDragStart={(e) => handleDragStart(e, person.id, "current", task.id)}
                          onDragEnd={handleDragEnd}
                          onDragOver={(e) => {
                            e.stopPropagation();
                            handleDragOver(e, person.id, "current");
                          }}
                          onDrop={(e) => {
                            e.stopPropagation();
                            handleDrop(e, person.id, "current");
                          }}
                          onRemove={() => unassignTaskFromPerson(task.id, person.id)}
                          onClick={() =>
                            onHighlightTask(highlightedTaskId === task.id ? null : task.id)
                          }
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
                      onClick={(e) => openTaskPicker(e, person.id, "queue")}
                      aria-label="Add task to queue"
                      title="Add task to queue"
                    >
                      +
                    </button>
                  </div>
                  <div
                    className={`tq-tasks-row ${isQueueDrop ? "tq-drop-active" : ""}`}
                    onDragOver={(e) => handleDragOver(e, person.id, "queue")}
                    onDrop={(e) => handleDrop(e, person.id, "queue")}
                  >
                    {queuedTasks.map((task) => {
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
                          onDragStart={(e) => handleDragStart(e, person.id, "queue", task.id)}
                          onDragEnd={handleDragEnd}
                          onDragOver={(e) => {
                            e.stopPropagation();
                            handleDragOver(e, person.id, "queue");
                          }}
                          onDrop={(e) => {
                            e.stopPropagation();
                            handleDrop(e, person.id, "queue");
                          }}
                          onRemove={() => unassignTaskFromPerson(task.id, person.id)}
                          onClick={() =>
                            onHighlightTask(highlightedTaskId === task.id ? null : task.id)
                          }
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
                    onSelect={(taskId) => addTaskToSlot(person.id, taskId, taskPickerState.target)}
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
        <button
          className="tq-expand-btn"
          onClick={toggleExpand}
          aria-label={isExpanded ? "Reset task queue size" : "Expand task queue"}
          title={isExpanded ? "Reset size" : "Expand"}
        >
          {isExpanded ? "⊡" : "⊞"}
        </button>
        <button className="tq-collapse-btn" onClick={onClose} aria-label="Collapse task queue">
          ∧
        </button>
      </div>
    </div>
  );
}
